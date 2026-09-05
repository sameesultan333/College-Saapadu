from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from database import get_db
from models import Canteen, MenuItem, Order, OrderItem
from schemas import CanteenCreate, CanteenUpdate
from websocket_manager import manager
from auth import require_manager, require_staff_or_manager, assert_canteen_in_scope, CurrentAccount


router = APIRouter(
    prefix="/canteens",
    tags=["Canteens"]
)


# Create canteen (Manager only, scoped to the manager's own college)
@router.post("/create")
def create_canteen(
    canteen: CanteenCreate,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    new_canteen = Canteen(
        name=canteen.name,
        location=canteen.location,
        college_id=account.college_id,
        is_active=True
    )

    db.add(new_canteen)
    db.commit()
    db.refresh(new_canteen)

    return {
        "message": "Canteen created",
        "canteen_id": new_canteen.id,
        "name": new_canteen.name
    }


# Every canteen for a college, open or closed. Closed canteens must still
# show up in the mobile app (dimmed, with their reopening time) rather than
# silently disappear -- customers need to see what's coming back and when,
# not wonder if a canteen still exists.
@router.get("")
def get_canteens(
    college_id: int | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Canteen)

    if college_id is not None:
        query = query.filter(Canteen.college_id == college_id)

    return query.all()


# Manager/Staff view: every canteen in the caller's own college, active or
# closed, so a closed canteen can still be found and reopened. college_id
# comes from the verified token, never the query string -- unlike the
# public listing above, which only ever shows what mobile customers should
# see (open canteens).
@router.get("/admin")
def get_canteens_admin(
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    return db.query(Canteen).filter(
        Canteen.college_id == account.college_id
    ).all()


# Edit a canteen's name/location/hours. Manager: any canteen in their own
# college. Staff: only their assigned canteen (see assert_canteen_in_scope).
@router.patch("/{canteen_id}")
def update_canteen(
    canteen_id: int,
    payload: CanteenUpdate,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    canteen = db.query(Canteen).filter(Canteen.id == canteen_id).first()
    if not canteen:
        raise HTTPException(status_code=404, detail="Canteen not found")

    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    if payload.name is not None:
        canteen.name = payload.name
    if payload.location is not None:
        canteen.location = payload.location
    if payload.opens_at is not None:
        canteen.opens_at = payload.opens_at
    if payload.closes_at is not None:
        canteen.closes_at = payload.closes_at

    db.commit()
    db.refresh(canteen)
    return canteen


# Open/close toggle. Same scope rule as update_canteen above. Closing is
# blocked while any order for this canteen is still in progress -- a
# student mid-order (or waiting on food already paid for) must not have
# their canteen vanish from under them. Reopening has no such restriction.
@router.patch("/{canteen_id}/toggle")
def toggle_canteen(
    canteen_id: int,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    canteen = db.query(Canteen).filter(Canteen.id == canteen_id).first()
    if not canteen:
        raise HTTPException(status_code=404, detail="Canteen not found")

    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    if canteen.is_active:
        active_orders = db.query(Order).filter(
            Order.canteen_id == canteen_id,
            Order.status.notin_(["DELIVERED", "CANCELLED"]),
        ).count()
        if active_orders > 0:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot close: {active_orders} order(s) still in progress for this canteen.",
            )

    canteen.is_active = not canteen.is_active
    db.commit()
    db.refresh(canteen)
    return canteen


# Canteen WebSocket
@router.websocket("/ws/{canteen_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    canteen_id: int
):
    await manager.connect(canteen_id, websocket)

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(canteen_id, websocket)


# Delete canteen (Manager only, scoped to the manager's own college)
@router.delete("/{canteen_id}")
async def delete_canteen(
    canteen_id: int,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    canteen = db.query(Canteen).filter(
        Canteen.id == canteen_id
    ).first()

    if not canteen:
        raise HTTPException(
            status_code=404,
            detail="Canteen not found"
        )

    if canteen.college_id != account.college_id:
        raise HTTPException(
            status_code=403,
            detail="Canteen belongs to a different college"
        )

    # Get all menu items for this canteen
    menu_items = db.query(MenuItem).filter(
        MenuItem.canteen_id == canteen_id
    ).all()

    menu_item_ids = [item.id for item in menu_items]

    # Step 1: Delete order items that reference these menu items
    if menu_item_ids:
        db.query(OrderItem).filter(
            OrderItem.menu_item_id.in_(menu_item_ids)
        ).delete(
            synchronize_session=False
        )

    # Step 2: Delete orders for this canteen
    db.query(Order).filter(
        Order.canteen_id == canteen_id
    ).delete()

    # Step 3: Delete menu items
    db.query(MenuItem).filter(
        MenuItem.canteen_id == canteen_id
    ).delete()

    # Step 4: Delete the canteen
    db.delete(canteen)
    db.commit()

    return {
        "message": f"Canteen {canteen_id} and all related data deleted successfully"
    }


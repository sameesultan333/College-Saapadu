from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import MenuItem, OrderItem, PrepType, Canteen
from schemas import StockUpdate, MenuItemUpdate
from modules.reports.tax import DEFAULT_GST_RATE
from websocket_manager import manager
from auth import require_staff_or_manager, assert_canteen_in_scope, CurrentAccount


router = APIRouter(
    prefix="/menu",
    tags=["Menu"]
)


def _get_canteen_or_404(db: Session, canteen_id: int) -> Canteen:
    canteen = db.query(Canteen).filter(Canteen.id == canteen_id).first()
    if not canteen:
        raise HTTPException(status_code=404, detail="Canteen not found")
    return canteen


# Create menu item (Manager or Staff, scoped to their own canteen --
# assert_canteen_in_scope below enforces that: Manager can add to any
# canteen in their college, Staff only to their one assigned canteen).
@router.post("/create")
def create_menu_item(
    name: str,
    price: float,
    stock: int,
    canteen_id: int,
    is_veg: bool,
    prep_type: PrepType = PrepType.RA,
    gst_rate: float = DEFAULT_GST_RATE,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    canteen = _get_canteen_or_404(db, canteen_id)

    if gst_rate < 0 or gst_rate > 100:
        raise HTTPException(status_code=400, detail="gst_rate must be between 0 and 100")

    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    # AUTO ASSIGN PREP TIME
    if prep_type == PrepType.RA:
        prep_time = 60
    elif prep_type == PrepType.COOK:
        prep_time = 180
    else:
        prep_time = 60  # safety fallback

    item = MenuItem(
        name=name,
        price=price,
        stock=stock,
        canteen_id=canteen_id,
        is_veg=is_veg,
        prep_type=prep_type,
        prep_time_seconds=prep_time,
        gst_rate=gst_rate
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return {
        "message": "Menu item added",
        "item_id": item.id,
        "prep_type": prep_type,
        "prep_time_seconds": prep_time,
        "gst_rate": item.gst_rate
    }


# Edit a menu item (Manager only). Changing price/gst_rate affects FUTURE
# orders only -- past OrderItem rows keep their own financial snapshot.
@router.patch("/{menu_item_id}")
def update_menu_item(
    menu_item_id: int,
    data: MenuItemUpdate,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    item = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if account.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")

    canteen = _get_canteen_or_404(db, item.canteen_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    if data.gst_rate is not None:
        if data.gst_rate < 0 or data.gst_rate > 100:
            raise HTTPException(status_code=400, detail="gst_rate must be between 0 and 100")
        item.gst_rate = data.gst_rate

    if data.name is not None:
        item.name = data.name

    if data.price is not None:
        item.price = data.price

    if data.is_veg is not None:
        item.is_veg = data.is_veg

    db.commit()
    db.refresh(item)

    return {
        "message": "Menu item updated",
        "id": item.id,
        "name": item.name,
        "price": item.price,
        "is_veg": item.is_veg,
        "gst_rate": item.gst_rate,
    }


# View menu items for a canteen
@router.get("/{canteen_id}")
def get_menu(
    canteen_id: int,
    db: Session = Depends(get_db)
):
    items = db.query(MenuItem).filter(
        MenuItem.canteen_id == canteen_id
    ).all()

    return [
        {
            "id": item.id,
            "name": item.name,
            "price": item.price,
            "stock": item.stock,
            "canteen_id": item.canteen_id,
            "is_veg": item.is_veg,
            "gst_rate": item.gst_rate
        }
        for item in items
    ]


# Delete a single menu item (Manager only)
@router.delete("/{menu_item_id}")
async def delete_menu_item(
    menu_item_id: int,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    menu_item = db.query(MenuItem).filter(
        MenuItem.id == menu_item_id
    ).first()

    if not menu_item:
        raise HTTPException(
            status_code=404,
            detail="Menu item not found"
        )

    if account.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")

    canteen = _get_canteen_or_404(db, menu_item.canteen_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    # Delete order items that reference this menu item
    db.query(OrderItem).filter(
        OrderItem.menu_item_id == menu_item_id
    ).delete()

    # Delete the menu item
    db.delete(menu_item)
    db.commit()

    return {
        "message": f"Menu item {menu_item_id} deleted successfully"
    }


# Update stock (Manager or Staff, scoped to their own canteen)
@router.put("/update-stock")
async def update_stock(
    data: StockUpdate,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    item = db.query(MenuItem).filter(
        MenuItem.id == data.menu_item_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Item not found"
        )

    canteen = _get_canteen_or_404(db, item.canteen_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    item.stock = data.stock
    db.commit()

    # Broadcast realtime update
    await manager.broadcast(
        item.canteen_id,
        {
            "event": "STOCK_UPDATE",
            "menu_item_id": item.id,
            "stock": item.stock
        }
    )

    return {
        "message": "Stock updated"
    }


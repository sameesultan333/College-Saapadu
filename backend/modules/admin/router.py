import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import Order, OrderItem, MenuItem, Canteen
from websocket_manager import manager
from modules.orders.service import (
    recalculate_eta,
    get_live_queue_data_for_canteen
)
from auth import require_staff_or_manager, require_manager, assert_canteen_in_scope, CurrentAccount

from utils import to_ist, IST
from modules.transactions.state import apply_order_status


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


def _get_canteen_or_404(db: Session, canteen_id: int) -> Canteen:
    canteen = db.query(Canteen).filter(Canteen.id == canteen_id).first()
    if not canteen:
        raise HTTPException(status_code=404, detail="Canteen not found")
    return canteen


# ============================================================
# UPDATE ORDER STATUS
# ============================================================

@router.put("/order/status")
async def admin_update_order_status(
    order_id: int,
    status: str,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(
        Order.id == order_id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    canteen = _get_canteen_or_404(db, order.canteen_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    status = status.upper()

    if status not in ["PREPARING", "READY"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid status"
        )

    # 1. Update status in DB -- validated by the central policy so an
    #    illegal move (e.g. DELIVERED -> PREPARING) is rejected here.
    apply_order_status(order, status)
    db.commit()

    # 2. Immediately broadcast status change
    print(
        "🔥 Broadcasting STATUS:",
        order.id,
        order.status
    )

    await manager.broadcast(
        order.canteen_id,
        {
            "event": "ORDER_STATUS_UPDATE",
            "order_id": order.id,
            "status": order.status
        }
    )

    # 3. Recalculate kitchen queue
    updated_etas = recalculate_eta(
        db,
        order.canteen_id
    )

    for eta_info in updated_etas:

        await manager.broadcast(
            order.canteen_id,
            {
                "event": "ETA_UPDATE",
                "order_id": eta_info["order_id"],
                "estimated_wait_time": eta_info[
                    "estimated_wait_time"
                ],
                "estimated_ready_at": eta_info[
                    "estimated_ready_at"
                ]
            }
        )

    # 4. If READY → activate pickup queue
    if status == "READY":

        try:
            queue_data = get_live_queue_data_for_canteen(
                order.canteen_id
            )

            people = queue_data.get(
                "queue_count",
                0
            )

            avg_sec = queue_data.get(
                "average_service_seconds",
                10
            )

            pickup_wait = int(
                people * avg_sec
            )

            ready_at = (
                int(time.time())
                + pickup_wait
            )

            order.estimated_wait_time = pickup_wait
            order.estimated_ready_at = ready_at

            db.commit()

            await manager.broadcast(
                order.canteen_id,
                {
                    "event": "PICKUP_QUEUE_UPDATE",
                    "order_id": order.id,
                    "people_in_line": people,
                    "estimated_ready_at": ready_at
                }
            )

        except Exception as e:
            print(
                "Camera queue fetch failed:",
                e
            )

    return {
        "success": True
    }


# ============================================================
# ADMIN STATISTICS
# ============================================================

@router.get("/stats/{canteen_id}")
def get_admin_stats(
    canteen_id: int,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    canteen = _get_canteen_or_404(db, canteen_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    today = datetime.now(IST).date()

    # Revenue comes from the per-line financial SNAPSHOT stored on
    # order_items, never from the live MenuItem price -- otherwise
    # editing a price would silently rewrite past revenue. Falls back to
    # the live price only for rows created before snapshots existed.
    amount = func.coalesce(OrderItem.gross_amount, MenuItem.price * OrderItem.quantity)

    rows = (
        db.query(Order.id, Order.status, Order.created_at,
                 func.coalesce(func.sum(amount), 0).label("total"))
        .outerjoin(OrderItem, OrderItem.order_id == Order.id)
        .outerjoin(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .filter(Order.canteen_id == canteen_id)
        .group_by(Order.id, Order.status, Order.created_at)
        .all()
    )

    today_orders = 0
    today_revenue = 0
    total_revenue = 0
    active_orders = 0

    for row in rows:
        order_total = float(row.total or 0)
        total_revenue += order_total

        if row.status != "DELIVERED":
            active_orders += 1

        if to_ist(row.created_at).date() == today:
            today_orders += 1
            today_revenue += order_total

    return {
        "today_orders": today_orders,
        "today_revenue": today_revenue,
        "total_revenue": total_revenue,
        "active_orders": active_orders
    }


# ============================================================
# RESET CANTEEN
# ============================================================

@router.put("/reset/{canteen_id}")
def reset_canteen(
    canteen_id: int,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    canteen = _get_canteen_or_404(db, canteen_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    # Get order IDs first
    orders = db.query(Order).filter(
        Order.canteen_id == canteen_id
    ).all()

    order_ids = [
        order.id
        for order in orders
    ]

    if order_ids:

        # Delete order items first
        db.query(OrderItem).filter(
            OrderItem.order_id.in_(order_ids)
        ).delete(
            synchronize_session=False
        )

    # Then delete orders
    db.query(Order).filter(
        Order.canteen_id == canteen_id
    ).delete(
        synchronize_session=False
    )

    db.commit()

    return {
        "message": "Canteen reset"
    }


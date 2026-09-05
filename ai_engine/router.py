import time

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Order
from websocket_manager import manager
from orders.service import get_live_queue_data_for_canteen


router = APIRouter(
    tags=["AI Queue"]
)


# ============================================================
# INTERNAL QUEUE UPDATE
# ============================================================

@router.post("/internal/queue-update")
async def queue_update(
    data: dict = Body(...),
    db: Session = Depends(get_db)
):

    canteen_id = data["canteen_id"]
    queue_count = data["queue_count"]
    avg_sec = data["average_service_seconds"]

    ready_orders = (
        db.query(Order)
        .filter(
            Order.canteen_id == canteen_id,
            Order.status == "READY"
        )
        .order_by(
            Order.created_at.asc()
        )
        .all()
    )

    now_ts = int(time.time())

    for index, order in enumerate(ready_orders):

        pickup_wait = (
            queue_count + index
        ) * avg_sec

        ready_at = (
            now_ts + pickup_wait
        )

        order.estimated_wait_time = pickup_wait
        order.estimated_ready_at = ready_at

        await manager.broadcast(
            canteen_id,
            {
                "event": "PICKUP_QUEUE_UPDATE",
                "order_id": order.id,
                "people_in_line": queue_count,
                "estimated_ready_at": ready_at
            }
        )

    db.commit()

    return {
        "ok": True
    }


# ============================================================
# QUEUE SNAPSHOT
# ============================================================

@router.get("/queue/snapshot")
def queue_snapshot():

    return get_live_queue_data_for_canteen(1)


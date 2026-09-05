import time
import requests

from sqlalchemy.orm import Session

from models import Order, OrderItem, MenuItem


# ============================================================
# AI ENGINE
# ============================================================

AI_ENGINE_URL = (
    "https://maiden-serve-increase-stick.trycloudflare.com"
    "/queue/snapshot"
)


def get_live_queue_data_for_canteen(
    canteen_id: int
):
    try:
        response = requests.get(
            AI_ENGINE_URL,
            timeout=2
        )

        return response.json()

    except:
        return {
            "queue_count": 0,
            "average_service_seconds": 10
        }


# ============================================================
# ETA CALCULATION
# ============================================================

def recalculate_eta(
    db: Session,
    canteen_id: int
):

    # Get active kitchen orders in FIFO order
    orders = (
        db.query(Order)
        .filter(
            Order.canteen_id == canteen_id,
            Order.status.in_(
                ["PLACED", "PREPARING"]
            )
        )
        .order_by(
            Order.created_at.asc()
        )
        .all()
    )

    now_ts = int(time.time())

    cumulative_delay = 0

    updated_etas = []

    for order in orders:

        # Get items for this order
        items = (
            db.query(OrderItem, MenuItem)
            .join(
                MenuItem,
                MenuItem.id == OrderItem.menu_item_id
            )
            .filter(
                OrderItem.order_id == order.id
            )
            .all()
        )

        # Determine preparation time for this order
        prep_times = [
            menu.prep_time_seconds
            for _, menu in items
        ]

        # If no items
        order_prep_time = (
            max(prep_times)
            if prep_times
            else 60
        )

        # Total wait =
        # cumulative previous + own prep time
        cumulative_delay += order_prep_time

        ready_at = (
            now_ts + cumulative_delay
        )

        order.estimated_wait_time = (
            cumulative_delay
        )

        order.estimated_ready_at = (
            ready_at
        )

        updated_etas.append(
            {
                "order_id": order.id,
                "estimated_wait_time": (
                    cumulative_delay
                ),
                "estimated_ready_at": (
                    ready_at
                )
            }
        )

    db.commit()

    return updated_etas


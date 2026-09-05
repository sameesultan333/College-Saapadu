from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
import logging
import secrets
import time

from database import get_db
from models import User, GuestCustomer, Canteen, MenuItem, Order, OrderItem, OrderVerification
from schemas import BatchOrderCreate, OrderStatusUpdate
from websocket_manager import manager

from modules.orders.service import (
    recalculate_eta,
    get_live_queue_data_for_canteen
)
from modules.notifications.service import notify_order_confirmed
from modules.reports.tax import compute_line_tax
from modules.transactions import checkout, idempotency as idem
from modules.transactions.state import apply_order_status
from errors import TransactionError, ErrorCode

log = logging.getLogger("orders.router")
from auth import (
    require_staff_or_manager,
    require_manager,
    require_operational_account,
    require_customer,
    assert_canteen_in_scope,
    get_current_account,
    CurrentAccount,
)

from utils import to_ist

router = APIRouter(
    tags=["Orders"]
)


def _get_canteen_or_404(db: Session, canteen_id: int) -> Canteen:
    canteen = db.query(Canteen).filter(Canteen.id == canteen_id).first()
    if not canteen:
        raise HTTPException(status_code=404, detail="Canteen not found")
    return canteen


def _resolve_order_actor(payload: BatchOrderCreate, account: CurrentAccount) -> BatchOrderCreate:
    """
    Who is this checkout actually for? Never the client's word for it.

    A registered customer's own token supplies user_id -- whatever the
    request body claims is ignored, closing the gap where any caller who
    knew another student's user_id could spend that student's wallet
    balance or place orders in their name (CLAUDE.md section 19/34).

    A Manager/Staff token is the counter/walk-in path: it may only place
    guest_id orders (never as a registered customer), matching how
    admin-dashboard's counter flow already works.
    """
    if account.account_type == "customer":
        if payload.guest_id:
            raise HTTPException(
                status_code=403,
                detail="A customer login cannot place a walk-in guest order.",
            )
        payload.user_id = account.account_id
        return payload

    if account.account_type == "staff" and account.role in ("manager", "staff"):
        if not payload.guest_id or payload.user_id:
            raise HTTPException(
                status_code=403,
                detail="Staff/Manager checkout must be a walk-in guest order.",
            )
        return payload

    raise HTTPException(status_code=403, detail="Not authorized to place orders.")


# ============================================================
# PLACE ORDER
# ============================================================

@router.post("/order/place")
async def place_order(
    payload: BatchOrderCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    account: CurrentAccount = Depends(get_current_account),
    db: Session = Depends(get_db)
):
    """
    Checkout entry point.

    Concurrency, tenancy, pricing and payment state are all enforced in
    modules/transactions/checkout.py. This handler owns only the HTTP
    concerns: caller identity, idempotent replay, one short DB
    transaction, and the post-commit side effects (websocket broadcast,
    notification).
    """
    payload = _resolve_order_actor(payload, account)
    request_fingerprint = idem.hash_request(payload.model_dump())

    # The client SHOULD send a stable Idempotency-Key held for the whole
    # logical checkout attempt (see admin-dashboard counter flow). When it
    # doesn't, fall back to a body hash bucketed into a short time window:
    # a double-tap / retry storm collapses to one order, while the same
    # customer legitimately re-ordering the same items later still gets a
    # new order. This is a safety net, not the mechanism.
    key = idempotency_key or f"auto-{int(time.time() // 120)}-{request_fingerprint}"

    record, replayed = idem.begin(db, key, "checkout", request_fingerprint)
    if replayed is not None:
        # A retry of a request we already completed: return the ORIGINAL
        # result rather than creating a second order.
        return replayed

    try:
        result = checkout.place_order(
            db,
            user_id=payload.user_id,
            guest_id=payload.guest_id,
            payment_mode=payload.payment_mode,
            canteens_payload=payload.canteens,
        )

        guest_code = None
        if payload.guest_id:
            guest = db.query(GuestCustomer).filter(
                GuestCustomer.id == payload.guest_id
            ).first()
            guest_code = guest.guest_code if guest else None

        response = {"orders": result["orders"], "guest_code": guest_code}

        idem.complete(db, record, response)

        # Single commit: order, items, reservations, inventory movement,
        # payment record and the idempotency result all land together, or
        # none of them do.
        db.commit()

    except TransactionError:
        db.rollback()
        # Free the key so the customer can genuinely retry a failed attempt.
        idem.discard(db, key)
        db.commit()
        raise
    except Exception:
        db.rollback()
        idem.discard(db, key)
        db.commit()
        log.exception("checkout.failed key=%s", key)
        raise TransactionError(
            ErrorCode.INVALID_ORDER,
            "Could not place the order. Please try again.",
            status_code=500,
        )

    # ---- post-commit side effects (never inside the transaction) ----
    for created in response["orders"]:
        try:
            notify_order_confirmed(
                created["order_id"],
                None,
                created.get("verification_token"),
            )
        except Exception:
            log.warning("notify.failed order_id=%s", created["order_id"])

        try:
            await manager.broadcast(
                created["canteen_id"],
                {
                    "event": "NEW_ORDER",
                    "order_id": created["order_id"],
                    "status": created["status"],
                    "estimated_wait_time": created["estimated_wait_time"],
                    "estimated_ready_at": created["estimated_ready_at"],
                },
            )
        except Exception:
            log.warning("broadcast.failed order_id=%s", created["order_id"])

    return response


# ============================================================
# UPDATE ORDER STATUS
# ============================================================

@router.put("/order/update-status")
async def update_order_status(
    payload: OrderStatusUpdate,
    account: CurrentAccount = Depends(require_operational_account),
    db: Session = Depends(get_db)
):

    order = db.query(Order).filter(
        Order.id == payload.order_id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    canteen = _get_canteen_or_404(db, order.canteen_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    apply_order_status(order, payload.status.upper())

    db.commit()

    # Recalculate and broadcast ETA updates
    # for everyone in the queue
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

    # Real-time status update
    await manager.broadcast(
        order.canteen_id,
        {
            "event": "ORDER_STATUS_UPDATE",
            "order_id": order.id,
            "status": order.status
        }
    )

    # Delivered event
    if order.status == "DELIVERED":

        print(
            f"✅ Broadcasting DELIVERED for Order #{order.id}"
        )

        await manager.broadcast(
            order.canteen_id,
            {
                "event": "ORDER_DELIVERED",
                "order_id": order.id
            }
        )

    return {
        "order_id": order.id,
        "status": order.status
    }


# ============================================================
# GET ACTIVE ORDERS FOR CANTEEN
# ============================================================

@router.get("/orders/canteen/{canteen_id}")
def get_orders_for_canteen(
    canteen_id: int,
    account: CurrentAccount = Depends(require_operational_account),
    db: Session = Depends(get_db)
):
    canteen = _get_canteen_or_404(db, canteen_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    orders = (
        db.query(Order, User, GuestCustomer)
        .outerjoin(
            User,
            User.id == Order.user_id
        )
        .outerjoin(
            GuestCustomer,
            GuestCustomer.id == Order.guest_id
        )
        .filter(
            Order.canteen_id == canteen_id,
            Order.status != "DELIVERED"
        )
        .order_by(
            Order.created_at.desc()
        )
        .all()
    )

    response = []

    for order, user, guest in orders:

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

        canteen = db.query(Canteen).filter(
            Canteen.id == order.canteen_id
        ).first()

        response.append(
            {
                "order_id": order.id,
                "status": order.status,
                "payment_mode": order.payment_mode,
                # Payment state is separate from fulfilment state: staff
                # need to see "cooking but not yet paid" as its own thing.
                "payment_status": order.payment_status,
                "total_amount": float(order.total_amount) if order.total_amount is not None else None,
                "student_name": (
                    user.name if user
                    else f"{guest.name} (Guest)" if guest
                    else "Customer"
                ),
                "phone": (
                    user.phone if user
                    else guest.phone if guest
                    else None
                ),
                "guest_code": guest.guest_code if guest else None,
                "guest_phone": guest.phone if guest else None,
                # Who the customer actually is -- a walk-in guest is never
                # necessarily a student, so this drives the label shown on
                # the kitchen/delivery order card instead of a hardcoded
                # "Student". Guests self-declare it at the counter; a
                # registered account's role stands in for it otherwise.
                "customer_category": (
                    guest.category.value if guest
                    else (user.role or "student").upper() if user
                    else "STUDENT"
                ),
                "canteen_name": (
                    canteen.name
                    if canteen
                    else "Canteen"
                ),
                # Active orders were missing this entirely -- the details
                # modal's Time row fell back to "N/A" for every order that
                # hadn't been delivered yet.
                "created_at": (
                    ist.isoformat() if (ist := to_ist(order.created_at)) else None
                ),
                "items": [
                    {
                        "name": menu.name,
                        "price": menu.price,
                        "quantity": item.quantity
                    }
                    for item, menu in items
                ]
            }
        )

    return response


# ============================================================
# DELETE AN ORDER
# ============================================================

@router.delete("/orders/{order_id}")
async def delete_order(
    order_id: int,
    account: CurrentAccount = Depends(require_manager),
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

    # Delete order items first
    db.query(OrderItem).filter(
        OrderItem.order_id == order_id
    ).delete()

    # Delete order
    db.delete(order)

    db.commit()

    return {
        "message": f"Order {order_id} deleted successfully"
    }


# ============================================================
# CLEAR ACTIVE ORDERS FOR A CANTEEN
# ============================================================

@router.put("/orders/clear/{canteen_id}")
async def clear_all_orders(
    canteen_id: int,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    canteen = _get_canteen_or_404(db, canteen_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    orders = db.query(Order).filter(
        Order.canteen_id == canteen_id,
        Order.status != "DELIVERED"
    ).all()

    for order in orders:
        apply_order_status(order, "DELIVERED")

    db.commit()

    # Recalculate and broadcast ETA updates
    updated_etas = recalculate_eta(
        db,
        canteen_id
    )

    for eta_info in updated_etas:

        await manager.broadcast(
            canteen_id,
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

    return {
        "message": (
            f"All orders for canteen "
            f"{canteen_id} marked as DELIVERED"
        ),
        "count": len(orders)
    }


# ============================================================
# USER ORDER HISTORY
# ============================================================

@router.get("/orders/user/history/{user_id}")
def get_user_order_history(
    user_id: int,
    account: CurrentAccount = Depends(require_customer),
    db: Session = Depends(get_db)
):
    # A customer's token proves who they are -- it must also be the one
    # deciding whose history this is. Without this check, any logged-in
    # customer could read any other user_id's order history by editing
    # the URL (CLAUDE.md section 34: never trust a client-supplied id).
    if user_id != account.account_id:
        raise HTTPException(status_code=403, detail="Not authorized for this user's history")

    orders = (
        db.query(Order)
        .filter(
            Order.user_id == user_id,
            Order.status == "DELIVERED"
        )
        .order_by(
            Order.created_at.desc()
        )
        .all()
    )

    result = []

    for order in orders:

        canteen = db.query(Canteen).filter(
            Canteen.id == order.canteen_id
        ).first()

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

        order_total = sum(
            menu.price * item.quantity
            for item, menu in items
        )

        result.append(
            {
                "order_id": order.id,
                "canteen_id": order.canteen_id,
                "canteen_name": (
                    canteen.name
                    if canteen
                    else "Canteen"
                ),
                "payment_mode": order.payment_mode,
                "created_at": (
                    ist.isoformat() if (ist := to_ist(order.created_at)) else None
                ),
                "total_amount": order_total,
                "status": order.status,
                "items": [
                    {
                        "name": menu.name,
                        "price": menu.price,
                        "quantity": item.quantity
                    }
                    for item, menu in items
                ]
            }
        )

    return result


# ============================================================
# CANTEEN ORDER HISTORY
# ============================================================

@router.get("/orders/history/{canteen_id}")
def get_order_history(
    canteen_id: int,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):

    canteen = db.query(Canteen).filter(
        Canteen.id == canteen_id
    ).first()

    if not canteen:
        raise HTTPException(status_code=404, detail="Canteen not found")

    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    orders = (
        db.query(Order, User, GuestCustomer)
        .outerjoin(
            User,
            User.id == Order.user_id
        )
        .outerjoin(
            GuestCustomer,
            GuestCustomer.id == Order.guest_id
        )
        .filter(
            Order.canteen_id == canteen_id,
            Order.status == "DELIVERED"
        )
        .order_by(
            Order.created_at.desc()
        )
        .all()
    )

    result = []

    for order, user, guest in orders:

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

        result.append(
            {
                "order_id": order.id,
                "canteen_name": (
                    canteen.name
                    if canteen
                    else "Canteen"
                ),
                "student_name": (
                    user.name if user
                    else f"{guest.name} (Guest)" if guest
                    else "Customer"
                ),
                "guest_code": guest.guest_code if guest else None,
                "phone": (
                    user.phone if user
                    else guest.phone if guest
                    else None
                ),
                "customer_category": (
                    guest.category.value if guest
                    else (user.role or "student").upper() if user
                    else "STUDENT"
                ),
                "payment_mode": order.payment_mode,
                "created_at": (
                    ist.isoformat() if (ist := to_ist(order.created_at)) else None
                ),
                "items": [
                    {
                        "name": menu.name,
                        "price": menu.price,
                        "quantity": item.quantity
                    }
                    for item, menu in items
                ]
            }
        )

    return result


# NOTE: this file used to have PUT /order/confirm-pickup and
# GET /orders/user/{user_id}. Both were completely unauthenticated --
# confirm-pickup let anyone mark ANY order DELIVERED just by knowing its
# order_id (no verification-token check at all), and the active-orders
# endpoint let anyone read anyone's live order queue position by
# guessing a user_id. Neither had a caller anywhere in admin-dashboard,
# delivery-dashboard or mobileAppFresh -- pickup handover now goes
# through POST /verification/scan -> POST /verification/{token}/verify
# (auditable, single-use, tenant-scoped), and the mobile app tracks
# orders one at a time via GET /track-order/{order_id}. Removed rather
# than authenticated, since an unused duplicate of an already-correct
# path is just a second thing to keep correct.


# ============================================================
# TRACK ORDER
# ============================================================

@router.get("/track-order/{order_id}")
def track_order(
    order_id: int,
    account: CurrentAccount = Depends(require_customer),
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

    # This endpoint now also carries the verification token (see below),
    # so an ownership check is mandatory, not optional -- without it any
    # logged-in customer could pull another customer's pickup QR just by
    # guessing an order_id.
    if order.user_id != account.account_id:
        raise HTTPException(status_code=403, detail="Not authorized for this order")

    canteen = db.query(Canteen).filter(
        Canteen.id == order.canteen_id
    ).first()

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

    # The pickup QR must carry the opaque per-order token, never the
    # numeric order_id -- an order_id is guessable/sequential, and the
    # legacy client that used to encode it directly let anyone construct
    # a plausible-looking QR for any order number. Every order created
    # via checkout.place_order() gets a verification row, so this should
    # always be present; the field is simply omitted for the rare
    # pre-existing row that predates verification tokens.
    verification = db.query(OrderVerification).filter(
        OrderVerification.order_id == order.id
    ).first()

    return {
        "order_id": order.id,
        "canteen_id": order.canteen_id,
        "canteen_name": (
            canteen.name
            if canteen
            else "Canteen"
        ),
        "status": order.status,
        "estimated_wait_time": order.estimated_wait_time,
        "estimated_ready_at": order.estimated_ready_at,
        "verification_token": verification.token if verification else None,
        "items": [
            {
                "name": menu.name,
                "price": menu.price,
                "quantity": item.quantity
            }
            for item, menu in items
        ]
    }


# ============================================================
# DELETE TRACK ORDER
# ============================================================

@router.delete("/track-order/{order_id}")
def delete_track_order(
    order_id: int,
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

    # Delete order items first
    db.query(OrderItem).filter(
        OrderItem.order_id == order_id
    ).delete()

    # Delete order
    db.delete(order)

    db.commit()

    return {
        "message": f"Track order {order_id} deleted"
    }


# ============================================================
# CLEAR ALL TRACK ORDERS
# ============================================================

@router.delete("/track-order/clear/all")
def clear_all_track_orders(
    db: Session = Depends(get_db)
):

    # Delete order items
    db.query(OrderItem).delete()

    # Delete orders
    db.query(Order).delete()

    db.commit()

    return {
        "message": "All track orders cleared"
    }


"""
Checkout orchestration.

    validate identity/tenancy
      -> validate items + authoritative pricing
      -> ATOMIC inventory reservation
      -> order + financial snapshot + payment record
      -> COMMIT (short transaction)
      -> payment workflow happens afterwards, outside the DB transaction

The database transaction covers only local state. No external payment
call is ever made while holding it, so we never sit on row locks waiting
on a network round trip.
"""

import logging
import secrets
import time
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from errors import insufficient_stock, invalid_order, not_found, unauthorized_tenant
from models import (
    Canteen,
    GuestCustomer,
    MenuItem,
    Order,
    OrderItem,
    OrderVerification,
    PaymentStatus,
    User,
)
from modules.payments import providers as payment_providers
from modules.payments import service as payment_service
from modules.reports.tax import compute_line_tax, to_decimal
from modules.transactions import inventory

log = logging.getLogger("transactions.checkout")


def _resolve_customer(db: Session, user_id, guest_id):
    if user_id and guest_id:
        raise invalid_order("Provide either user_id or guest_id, not both.")
    if not user_id and not guest_id:
        raise invalid_order("Either user_id or guest_id is required.")

    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise not_found("User not found.")
        return user, None

    guest = db.query(GuestCustomer).filter(GuestCustomer.id == guest_id).first()
    if not guest:
        raise not_found("Guest not found.")
    return None, guest


def _assert_tenant(customer_college_id: int, canteen: Canteen):
    """
    Tenant boundary: the customer's college must own the canteen.

    Previously only guests were checked; a registered user's college was
    never compared, so a client could point an order at another college's
    canteen. Both identity types are validated here.
    """
    if customer_college_id != canteen.college_id:
        raise unauthorized_tenant("This canteen belongs to a different college.")


def place_order(db: Session, *, user_id=None, guest_id=None, payment_mode: str,
                canteens_payload, actor_account_id=None) -> dict:
    """
    Create one order per canteen in the payload. Raises a TransactionError
    on any failure; the caller rolls back so nothing partial persists.
    """
    user, guest = _resolve_customer(db, user_id, guest_id)
    customer_college_id = user.college_id if user else guest.college_id
    method = (payment_mode or "").upper()

    if guest and method == "WALLET":
        raise invalid_order("Wallet payment is not available for walk-in customers.")

    created_orders = []

    for canteen_order in canteens_payload:
        canteen = db.query(Canteen).filter(Canteen.id == canteen_order.canteen_id).first()
        if not canteen:
            raise not_found("Canteen not found.")

        _assert_tenant(customer_college_id, canteen)

        if not canteen.is_active:
            raise invalid_order(f"{canteen.name} is currently closed.")

        if not canteen_order.items:
            raise invalid_order("An order must contain at least one item.")

        # --- authoritative pricing: never trust client price/GST/stock ---
        lines = []
        order_total = Decimal("0")

        for line in canteen_order.items:
            if line.quantity is None or line.quantity <= 0:
                raise invalid_order("Item quantity must be greater than zero.")

            menu = db.query(MenuItem).filter(
                MenuItem.id == line.menu_item_id,
                MenuItem.canteen_id == canteen.id,
            ).first()
            if not menu:
                raise not_found("Menu item not found in this canteen.")

            snapshot = compute_line_tax(menu.price, line.quantity, menu.gst_rate)
            order_total += snapshot["gross_amount"]
            lines.append((menu, line.quantity, snapshot))

        # --- wallet: atomic conditional debit, no read-then-write ---
        if method == "WALLET":
            debited = db.execute(text("""
                UPDATE users
                   SET wallet_balance = wallet_balance - :amount
                 WHERE id = :user_id
                   AND wallet_balance >= :amount
            """), {"amount": order_total, "user_id": user.id})
            if debited.rowcount != 1:
                raise invalid_order("Insufficient wallet balance.")

        # --- ETA (informational only, never authoritative) ---
        orders_ahead = db.query(Order).filter(
            Order.canteen_id == canteen.id,
            Order.status.in_(["PLACED", "PREPARING"]),
        ).count()
        prep = max([m.prep_time_seconds or 60 for m, _, _ in lines] or [60])
        wait_seconds = (orders_ahead * prep) + prep

        order = Order(
            user_id=user.id if user else None,
            guest_id=guest.id if guest else None,
            canteen_id=canteen.id,
            status="PLACED",
            payment_status=PaymentStatus.PENDING.value,
            payment_mode=method,
            total_amount=order_total,
            estimated_wait_time=wait_seconds,
            estimated_ready_at=int(time.time()) + wait_seconds,
            order_type="COUNTER" if method == "CASH" else "ONLINE",
        )
        db.add(order)
        db.flush()

        # --- ATOMIC RESERVATION (the concurrency boundary) ---
        for menu, qty, snapshot in lines:
            if not inventory.try_reserve_stock(db, menu.id, qty):
                # The DB refused: someone else took the last units between
                # our price read and here. Raising aborts the whole
                # transaction, so any reservations already taken in this
                # order are rolled back with it -- no stranded stock.
                raise insufficient_stock(menu.name, qty, menu.stock or 0)

            inventory.create_reservation(db, order.id, menu.id, qty)

            db.add(OrderItem(
                order_id=order.id,
                menu_item_id=menu.id,
                quantity=qty,
                unit_price=snapshot["unit_price"],
                gst_rate=snapshot["gst_rate"],
                gross_amount=snapshot["gross_amount"],
                taxable_amount=snapshot["taxable_amount"],
                cgst_amount=snapshot["cgst_amount"],
                sgst_amount=snapshot["sgst_amount"],
                total_gst_amount=snapshot["total_gst_amount"],
            ))

        # --- payment record via the provider boundary ---
        provider = payment_providers.get_provider(method)
        intent = provider.create_intent(order_id=order.id, amount=order_total, method=method)

        payment = payment_service.create_payment(
            db, order,
            amount=order_total,
            method=method,
            provider=intent.provider,
            provider_payment_id=intent.provider_payment_id,
            status=PaymentStatus.PENDING.value,
        )

        # Wallet settles inside our own database, so it commits here.
        # A CASH order placed by staff for a walk-in guest (the counter
        # flow) has already had the cash physically handed over and
        # counted -- see admin-dashboard's cash-received/change modal,
        # which runs before this call -- so it settles immediately too.
        # A CASH order placed by a *customer* through the mobile app
        # ("Cash on Pickup") is different: nothing has been paid yet, so
        # it must stay PENDING like UPI, awaiting the same staff
        # confirmation at pickup. `guest` is only ever set on the
        # staff/counter path (see _resolve_order_actor in
        # modules/orders/router.py), so it's the correct signal here --
        # not the payment method alone.
        #
        # UPI (and mobile CASH-on-pickup) stay PENDING and hold their
        # reservation until an authorised confirmation (today) or a
        # gateway webhook (later, UPI only).
        counter_cash_already_collected = bool(guest) and method == "CASH"
        if intent.settled_immediately or counter_cash_already_collected:
            payment_service.mark_payment_success(
                db, payment,
                account_id=actor_account_id,
                confirmation_method="WALLET_INTERNAL" if intent.settled_immediately else "COUNTER_CASH_COLLECTED",
            )

        verification_token = secrets.token_urlsafe(24)
        db.add(OrderVerification(order_id=order.id, token=verification_token))

        db.refresh(order)
        created_orders.append({
            "order_id": order.id,
            "canteen_id": canteen.id,
            "status": order.status,
            "payment_status": order.payment_status,
            "payment_id": payment.id,
            "total_amount": float(to_decimal(order_total)),
            "estimated_wait_time": wait_seconds,
            "estimated_ready_at": order.estimated_ready_at,
            "verification_token": verification_token,
        })

        log.info("checkout.order_created order_id=%s canteen=%s total=%s method=%s payment=%s",
                 order.id, canteen.id, order_total, method, payment.status)

    return {"orders": created_orders}

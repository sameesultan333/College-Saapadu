"""
Payment state service.

Every payment state change in the system goes through here -- the
development/manual confirmation today and a real gateway webhook later
use the SAME transitions, so replacing the provider cannot weaken the
rules. Nothing in this module trusts a client-supplied success flag.
"""

import logging
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from errors import TransactionError, ErrorCode
from models import (
    Order,
    Payment,
    PaymentEvent,
    PaymentStatus,
    Reservation,
    ReservationStatus,
)
from modules.transactions import inventory
from modules.transactions.state import (
    ORDER_NEEDS_RESOLUTION,
    assert_payment_transition,
)

log = logging.getLogger("transactions.payments")


# ------------------------------------------------------------------
# Guarded status claim -- the basis of payment idempotency.
# ------------------------------------------------------------------
# A duplicate webhook, a double-tapped confirm button and a retried
# request all funnel into this one UPDATE. Only a row still in the
# expected state is moved, so the second attempt changes nothing and
# cannot trigger a second inventory commit.

_CLAIM_PAYMENT_SQL = text("""
    UPDATE payments
       SET status = :target,
           updated_at = :now,
           confirmed_at = CASE WHEN :target = 'SUCCESS' THEN :now ELSE confirmed_at END,
           confirmed_by_account_id = CASE WHEN :target = 'SUCCESS'
                                          THEN :account_id ELSE confirmed_by_account_id END,
           confirmation_method = CASE WHEN :target = 'SUCCESS'
                                      THEN COALESCE(:confirmation_method, confirmation_method)
                                      ELSE confirmation_method END,
           failure_reason = CASE WHEN :target = 'FAILED'
                                 THEN :failure_reason ELSE failure_reason END
     WHERE id = :payment_id
       AND status = :expected
""")


def _claim_payment(db: Session, payment: Payment, expected: str, target: str,
                   account_id=None, confirmation_method=None, failure_reason=None) -> bool:
    result = db.execute(_CLAIM_PAYMENT_SQL, {
        "payment_id": payment.id,
        "expected": expected,
        "target": target,
        "now": datetime.utcnow(),
        "account_id": account_id,
        "confirmation_method": confirmation_method,
        "failure_reason": failure_reason,
    })
    return result.rowcount == 1


def create_payment(db: Session, order: Order, amount, method: str,
                   provider: str, provider_payment_id: str | None,
                   status: str = PaymentStatus.PENDING.value) -> Payment:
    payment = Payment(
        order_id=order.id,
        amount=amount,
        status=status,
        method=method,
        provider=provider,
        provider_payment_id=provider_payment_id,
    )
    db.add(payment)
    db.flush()
    return payment


def record_provider_event(db: Session, provider: str, provider_event_id: str,
                          event_type: str, payment_id: int | None) -> bool:
    """
    Webhook de-duplication.

    Returns True if this event is new and should be processed, False if
    it has been seen before. The UNIQUE constraint on
    (provider, provider_event_id) is the actual guarantee -- two
    simultaneous deliveries of the same event cannot both win.
    """
    from sqlalchemy.exc import IntegrityError

    event = PaymentEvent(
        provider=provider,
        provider_event_id=provider_event_id,
        event_type=event_type,
        payment_id=payment_id,
    )
    db.add(event)
    try:
        with db.begin_nested():
            db.flush()
        return True
    except IntegrityError:
        db.rollback()
        log.info("payment.event.duplicate provider=%s event_id=%s", provider, provider_event_id)
        return False


# ------------------------------------------------------------------
# SETTLEMENT
# ------------------------------------------------------------------

def mark_payment_success(db: Session, payment: Payment, *,
                         account_id: int | None = None,
                         confirmation_method: str | None = None) -> dict:
    """
    Settle a payment and commit its inventory. Idempotent.

    Expiry-vs-payment policy (business decision, explicitly approved):
    payment wins. If the reservation already expired, we attempt an
    atomic re-reservation. If stock is genuinely gone we do NOT invent a
    refund or a substitution -- the order is parked in NEEDS_RESOLUTION
    with the payment left SUCCESS, so an authorised human decides.
    Inventory is never double-allocated and the money is never silently
    written off.
    """
    order = db.query(Order).filter(Order.id == payment.order_id).first()
    if order is None:
        raise TransactionError(ErrorCode.INVALID_ORDER, "Order not found for payment.", 404)

    if payment.status == PaymentStatus.SUCCESS.value:
        log.info("payment.success.noop payment_id=%s order_id=%s", payment.id, order.id)
        return {"changed": False, "order_status": order.status,
                "payment_status": payment.status}

    assert_payment_transition(payment.status, PaymentStatus.SUCCESS.value)

    if not _claim_payment(db, payment, payment.status, PaymentStatus.SUCCESS.value,
                          account_id=account_id, confirmation_method=confirmation_method):
        # Another concurrent confirmation won; treat as a no-op.
        db.refresh(payment)
        log.info("payment.success.raced payment_id=%s status=%s", payment.id, payment.status)
        return {"changed": False, "order_status": order.status,
                "payment_status": payment.status}

    committed = inventory.commit_order_reservations(db, order.id)

    outcome = "COMMITTED"
    if committed == 0:
        # Nothing ACTIVE left to commit. Either it was already committed
        # (fine, idempotent) or the hold expired before payment landed.
        expired = db.query(Reservation).filter(
            Reservation.order_id == order.id,
            Reservation.status == ReservationStatus.EXPIRED.value,
        ).all()

        already_committed = db.query(Reservation).filter(
            Reservation.order_id == order.id,
            Reservation.status == ReservationStatus.COMMITTED.value,
        ).count()

        if expired and not already_committed:
            outcome = _recover_expired_reservations(db, order, expired)

    order.payment_status = PaymentStatus.SUCCESS.value
    db.add(order)
    db.refresh(payment)

    log.info("payment.success payment_id=%s order_id=%s outcome=%s method=%s by=%s",
             payment.id, order.id, outcome, confirmation_method, account_id)

    return {"changed": True, "outcome": outcome,
            "order_status": order.status, "payment_status": payment.status}


def _recover_expired_reservations(db: Session, order: Order, expired: list[Reservation]) -> str:
    """
    Payment arrived after the hold expired. Try to take the stock back
    atomically; if we can't, park the order for a human.
    """
    reclaimed = []
    for old in expired:
        if inventory.try_reserve_stock(db, old.menu_item_id, old.quantity):
            fresh = inventory.create_reservation(db, order.id, old.menu_item_id, old.quantity)
            db.flush()
            inventory.commit_reservation(db, fresh)
            reclaimed.append(old.menu_item_id)
        else:
            # Roll back anything we just took so we don't strand stock in
            # a half-recovered order.
            for item_id, qty in [(r.menu_item_id, r.quantity) for r in expired if r.menu_item_id in reclaimed]:
                db.execute(text(
                    "UPDATE menu_items SET committed = committed - :q, stock = stock + :q "
                    "WHERE id = :i AND committed >= :q"
                ), {"q": qty, "i": item_id})

            order.status = ORDER_NEEDS_RESOLUTION
            db.add(order)
            log.warning(
                "payment.success.needs_resolution order_id=%s item=%s "
                "reason=stock_unavailable_after_expiry", order.id, old.menu_item_id)
            return "NEEDS_RESOLUTION"

    log.info("payment.success.reclaimed order_id=%s items=%s", order.id, reclaimed)
    return "RECOMMITTED_AFTER_EXPIRY"


def mark_payment_failed(db: Session, payment: Payment, reason: str = "PROVIDER_FAILED") -> dict:
    """Fail a payment and release its inventory. Idempotent."""
    order = db.query(Order).filter(Order.id == payment.order_id).first()

    if payment.status == PaymentStatus.FAILED.value:
        return {"changed": False, "payment_status": payment.status}

    assert_payment_transition(payment.status, PaymentStatus.FAILED.value)

    if not _claim_payment(db, payment, payment.status, PaymentStatus.FAILED.value,
                          failure_reason=reason):
        db.refresh(payment)
        return {"changed": False, "payment_status": payment.status}

    released = inventory.release_order_reservations(db, payment.order_id)

    if order is not None:
        order.payment_status = PaymentStatus.FAILED.value
        db.add(order)

    db.refresh(payment)
    log.info("payment.failed payment_id=%s order_id=%s released=%s reason=%s",
             payment.id, payment.order_id, released, reason)

    return {"changed": True, "released": released, "payment_status": payment.status}

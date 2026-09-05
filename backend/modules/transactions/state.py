"""
Centralised state-transition policy.

All legal moves for orders, payments and reservations live here rather
than being scattered across route handlers, so an illegal transition
(PAID -> PAYMENT_PENDING, RELEASED -> COMMITTED, DELIVERED -> RESERVED)
is impossible to introduce by editing one endpoint in isolation.
"""

from models import PaymentStatus, ReservationStatus
from errors import invalid_transition

# ------------------------------------------------------------------
# ORDER
# ------------------------------------------------------------------
# Existing fulfilment values are preserved exactly -- dashboards and the
# mobile app depend on them. NEEDS_RESOLUTION is the parking state for
# "payment succeeded but the stock is gone" (see the expiry-vs-payment
# policy in modules/payments/service.py).

ORDER_CREATED = "CREATED"
ORDER_PLACED = "PLACED"
ORDER_PREPARING = "PREPARING"
ORDER_READY = "READY"
ORDER_DELIVERED = "DELIVERED"
ORDER_CANCELLED = "CANCELLED"
ORDER_NEEDS_RESOLUTION = "NEEDS_RESOLUTION"

ORDER_TRANSITIONS = {
    ORDER_CREATED: {ORDER_PLACED, ORDER_CANCELLED, ORDER_NEEDS_RESOLUTION},
    ORDER_PLACED: {ORDER_PREPARING, ORDER_READY, ORDER_DELIVERED,
                   ORDER_CANCELLED, ORDER_NEEDS_RESOLUTION},
    ORDER_PREPARING: {ORDER_READY, ORDER_DELIVERED, ORDER_CANCELLED,
                      ORDER_NEEDS_RESOLUTION},
    ORDER_READY: {ORDER_DELIVERED, ORDER_CANCELLED, ORDER_NEEDS_RESOLUTION},
    # Terminal.
    ORDER_DELIVERED: set(),
    ORDER_CANCELLED: set(),
    # Only a human resolution moves an order out of this state.
    ORDER_NEEDS_RESOLUTION: {ORDER_PREPARING, ORDER_READY, ORDER_DELIVERED,
                             ORDER_CANCELLED},
}

# ------------------------------------------------------------------
# PAYMENT
# ------------------------------------------------------------------

PAYMENT_TRANSITIONS = {
    PaymentStatus.NOT_STARTED.value: {PaymentStatus.PENDING.value,
                                      PaymentStatus.SUCCESS.value,
                                      PaymentStatus.FAILED.value},
    PaymentStatus.PENDING.value: {PaymentStatus.SUCCESS.value,
                                  PaymentStatus.FAILED.value},
    # A settled payment may only be refunded -- never un-succeeded, and
    # never moved back to PENDING by a late/duplicate provider callback.
    PaymentStatus.SUCCESS.value: {PaymentStatus.REFUNDED.value},
    PaymentStatus.FAILED.value: set(),
    PaymentStatus.REFUNDED.value: set(),
}

# ------------------------------------------------------------------
# RESERVATION
# ------------------------------------------------------------------
# COMMITTED and RELEASED are terminal in both directions: inventory that
# has been sold cannot be handed back by a retry, and inventory that has
# been returned cannot be re-sold without a fresh reservation.

RESERVATION_TRANSITIONS = {
    ReservationStatus.ACTIVE.value: {ReservationStatus.COMMITTED.value,
                                     ReservationStatus.RELEASED.value,
                                     ReservationStatus.EXPIRED.value},
    ReservationStatus.COMMITTED.value: set(),
    ReservationStatus.RELEASED.value: set(),
    # An expired hold has already returned its units to available stock;
    # recovering it requires a brand-new reservation, not a transition.
    ReservationStatus.EXPIRED.value: set(),
}


def _check(table, entity, current, target):
    if current == target:
        # Idempotent no-op: re-applying the state a record is already in
        # is always safe and must not raise.
        return False
    if target not in table.get(current, set()):
        raise invalid_transition(entity, current, target)
    return True


def assert_order_transition(current: str, target: str) -> bool:
    """True if the move should be applied, False if it's a no-op."""
    return _check(ORDER_TRANSITIONS, "Order", current, target)


def assert_payment_transition(current: str, target: str) -> bool:
    return _check(PAYMENT_TRANSITIONS, "Payment", current, target)


def assert_reservation_transition(current: str, target: str) -> bool:
    return _check(RESERVATION_TRANSITIONS, "Reservation", current, target)


def is_terminal_order(status: str) -> bool:
    return not ORDER_TRANSITIONS.get(status, set())


def apply_order_status(order, target: str) -> bool:
    """
    The ONE place an order's fulfilment status changes.

    Validates the move against ORDER_TRANSITIONS and raises
    INVALID_STATE_TRANSITION on an illegal one (DELIVERED -> PLACED,
    anything out of CANCELLED, ...). Returns False for a no-op so callers
    can stay idempotent under retries.
    """
    current = order.status or ORDER_PLACED
    if not assert_order_transition(current, target):
        return False
    order.status = target
    return True

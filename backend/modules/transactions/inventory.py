"""
Atomic inventory operations.

Every bucket move is a single guarded UPDATE whose WHERE clause carries
the precondition, so PostgreSQL -- not application code -- decides the
winner under concurrency. Nothing here ever reads a quantity, decides in
Python, and writes it back.

Bucket model (see MenuItem):
    stock     = available to sell
    reserved  = held for an unpaid order
    committed = sold

    on_hand   = stock + reserved + committed
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from config import RESERVATION_TTL_MINUTES
from models import Reservation, ReservationStatus

log = logging.getLogger("transactions.inventory")


# ------------------------------------------------------------------
# RESERVE:  stock -> reserved
# ------------------------------------------------------------------
# The `AND stock >= :qty` guard is the whole concurrency story. With 20
# concurrent buyers and 1 unit left, PostgreSQL serialises the row
# updates: the first matches and decrements, the other 19 match zero rows
# and are told there is no stock. No SELECT-then-UPDATE window exists.

_RESERVE_SQL = text("""
    UPDATE menu_items
       SET stock = stock - :qty,
           reserved = reserved + :qty
     WHERE id = :item_id
       AND stock >= :qty
""")

_RELEASE_SQL = text("""
    UPDATE menu_items
       SET stock = stock + :qty,
           reserved = reserved - :qty
     WHERE id = :item_id
       AND reserved >= :qty
""")

_COMMIT_SQL = text("""
    UPDATE menu_items
       SET reserved = reserved - :qty,
           committed = committed + :qty
     WHERE id = :item_id
       AND reserved >= :qty
""")


def try_reserve_stock(db: Session, menu_item_id: int, quantity: int) -> bool:
    """Atomically move units available -> reserved. False if not enough."""
    if quantity <= 0:
        return False
    result = db.execute(_RESERVE_SQL, {"item_id": menu_item_id, "qty": quantity})
    return result.rowcount == 1


def create_reservation(db: Session, order_id: int, menu_item_id: int, quantity: int) -> Reservation:
    """Durable ledger row for stock already moved into `reserved`."""
    reservation = Reservation(
        order_id=order_id,
        menu_item_id=menu_item_id,
        quantity=quantity,
        status=ReservationStatus.ACTIVE.value,
        expires_at=datetime.utcnow() + timedelta(minutes=RESERVATION_TTL_MINUTES),
    )
    db.add(reservation)
    return reservation


# ------------------------------------------------------------------
# COMMIT / RELEASE -- both idempotent
# ------------------------------------------------------------------
# Idempotency comes from the guarded status UPDATE: the row is only moved
# out of ACTIVE if it is still ACTIVE. A retry updates zero rows, returns
# False, and crucially never touches the inventory buckets -- so a
# repeated release cannot hand back stock twice.

_CLAIM_RESERVATION_SQL = text("""
    UPDATE reservations
       SET status = :target,
           committed_at = CASE WHEN :target = 'COMMITTED' THEN :now ELSE committed_at END,
           released_at  = CASE WHEN :target IN ('RELEASED','EXPIRED') THEN :now ELSE released_at END
     WHERE id = :reservation_id
       AND status = 'ACTIVE'
""")


def _claim(db: Session, reservation_id: int, target: str) -> bool:
    result = db.execute(_CLAIM_RESERVATION_SQL, {
        "reservation_id": reservation_id,
        "target": target,
        "now": datetime.utcnow(),
    })
    return result.rowcount == 1


def commit_reservation(db: Session, reservation: Reservation) -> bool:
    """
    ACTIVE -> COMMITTED, moving reserved -> committed.
    Returns False (no-op) if the reservation was already settled.
    """
    if not _claim(db, reservation.id, ReservationStatus.COMMITTED.value):
        log.info("reservation.commit.noop reservation_id=%s status=%s",
                 reservation.id, reservation.status)
        return False

    db.execute(_COMMIT_SQL, {"item_id": reservation.menu_item_id, "qty": reservation.quantity})
    log.info("reservation.commit reservation_id=%s item=%s qty=%s",
             reservation.id, reservation.menu_item_id, reservation.quantity)
    return True


def release_reservation(db: Session, reservation: Reservation,
                        target: str = ReservationStatus.RELEASED.value) -> bool:
    """
    ACTIVE -> RELEASED/EXPIRED, moving reserved -> available.
    Returns False (no-op) if already released, expired or committed --
    a retry must never return the same units twice.
    """
    if not _claim(db, reservation.id, target):
        log.info("reservation.release.noop reservation_id=%s status=%s",
                 reservation.id, reservation.status)
        return False

    db.execute(_RELEASE_SQL, {"item_id": reservation.menu_item_id, "qty": reservation.quantity})
    log.info("reservation.release reservation_id=%s item=%s qty=%s target=%s",
             reservation.id, reservation.menu_item_id, reservation.quantity, target)
    return True


def release_order_reservations(db: Session, order_id: int,
                               target: str = ReservationStatus.RELEASED.value) -> int:
    """Release every ACTIVE reservation for an order. Safe to retry."""
    released = 0
    rows = db.query(Reservation).filter(
        Reservation.order_id == order_id,
        Reservation.status == ReservationStatus.ACTIVE.value,
    ).all()
    for reservation in rows:
        if release_reservation(db, reservation, target=target):
            released += 1
    return released


def commit_order_reservations(db: Session, order_id: int) -> int:
    """Commit every ACTIVE reservation for an order. Safe to retry."""
    committed = 0
    rows = db.query(Reservation).filter(
        Reservation.order_id == order_id,
        Reservation.status == ReservationStatus.ACTIVE.value,
    ).all()
    for reservation in rows:
        if commit_reservation(db, reservation):
            committed += 1
    return committed


def expire_due_reservations(db: Session, now: datetime | None = None, limit: int = 500) -> int:
    """
    Sweeper entry point: expire ACTIVE reservations past expires_at,
    returning their units to available stock.

    Expiry never depends on a client telling us it went away -- an app
    that is force-killed, loses battery or drops network still has its
    hold reclaimed here.
    """
    from models import Order, PaymentStatus

    now = now or datetime.utcnow()

    # Never reclaim stock from an order that is already being fulfilled
    # or already paid. Once staff accept an order into the kitchen, the
    # units are physically committed to that customer regardless of how
    # long the payment confirmation takes -- expiring it would let the
    # same food be sold twice.
    due = (
        db.query(Reservation)
        .join(Order, Order.id == Reservation.order_id)
        .filter(
            Reservation.status == ReservationStatus.ACTIVE.value,
            Reservation.expires_at.isnot(None),
            Reservation.expires_at <= now,
            Order.status.notin_(["PREPARING", "READY", "DELIVERED", "NEEDS_RESOLUTION"]),
            Order.payment_status != PaymentStatus.SUCCESS.value,
        )
        .limit(limit)
        .all()
    )

    expired = 0
    for reservation in due:
        if release_reservation(db, reservation, target=ReservationStatus.EXPIRED.value):
            expired += 1

    if expired:
        db.commit()
        log.info("reservation.sweep expired=%s", expired)
    return expired

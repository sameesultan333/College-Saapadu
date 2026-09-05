"""
Transaction-core correctness tests.

These run against the REAL PostgreSQL database (concurrency bugs do not
reproduce against SQLite or mocks) using a throwaway college that is
deleted afterwards. Concurrency tests use real threads on real
connections so PostgreSQL actually arbitrates the races.

Run:  python -m pytest tests/test_transaction_core.py -v
"""

import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal  # noqa: E402
from errors import TransactionError, ErrorCode  # noqa: E402
from models import (  # noqa: E402
    Canteen, College, GuestCustomer, MenuItem, Order, OrderItem,
    Payment, PaymentStatus, PaymentEvent, Reservation, ReservationStatus, User,
    OrderVerification, IdempotencyKey,
)
from modules.payments import service as payment_service  # noqa: E402
from modules.reports.tax import compute_line_tax  # noqa: E402
from modules.transactions import checkout, inventory  # noqa: E402
from modules.transactions.state import (  # noqa: E402
    assert_payment_transition, assert_reservation_transition, assert_order_transition,
)

TEST_COLLEGE = "__TXCORE_TEST__"


class Line:
    def __init__(self, menu_item_id, quantity):
        self.menu_item_id = menu_item_id
        self.quantity = quantity


class CanteenOrder:
    def __init__(self, canteen_id, items):
        self.canteen_id = canteen_id
        self.items = items


# ------------------------------------------------------------------
# fixtures
# ------------------------------------------------------------------

def _purge(db):
    colleges = db.query(College).filter(College.name == TEST_COLLEGE).all()
    cids = [c.id for c in colleges]
    if not cids:
        return
    canteen_ids = [c.id for c in db.query(Canteen).filter(Canteen.college_id.in_(cids)).all()]
    order_ids = [o.id for o in db.query(Order).filter(Order.canteen_id.in_(canteen_ids)).all()] if canteen_ids else []
    if order_ids:
        db.query(OrderVerification).filter(OrderVerification.order_id.in_(order_ids)).delete(synchronize_session=False)
        db.query(Reservation).filter(Reservation.order_id.in_(order_ids)).delete(synchronize_session=False)
        payment_ids = [p.id for p in db.query(Payment).filter(Payment.order_id.in_(order_ids)).all()]
        if payment_ids:
            db.query(PaymentEvent).filter(PaymentEvent.payment_id.in_(payment_ids)).delete(synchronize_session=False)
        db.query(Payment).filter(Payment.order_id.in_(order_ids)).delete(synchronize_session=False)
        db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
        db.query(Order).filter(Order.id.in_(order_ids)).delete(synchronize_session=False)
    if canteen_ids:
        db.query(MenuItem).filter(MenuItem.canteen_id.in_(canteen_ids)).delete(synchronize_session=False)
    db.query(GuestCustomer).filter(GuestCustomer.college_id.in_(cids)).delete(synchronize_session=False)
    db.query(User).filter(User.college_id.in_(cids)).delete(synchronize_session=False)
    if canteen_ids:
        db.query(Canteen).filter(Canteen.id.in_(canteen_ids)).delete(synchronize_session=False)
    db.query(College).filter(College.id.in_(cids)).delete(synchronize_session=False)
    db.query(IdempotencyKey).filter(IdempotencyKey.scope == "test").delete(synchronize_session=False)
    db.commit()


@pytest.fixture
def env():
    db = SessionLocal()
    _purge(db)

    college = College(name=TEST_COLLEGE, is_active=True)
    db.add(college)
    db.flush()

    canteen = Canteen(name="TX Canteen", college_id=college.id, is_active=True)
    db.add(canteen)
    db.flush()

    guest = GuestCustomer(college_id=college.id, guest_code="G-TEST01",
                          name="Test Guest", phone="9000000999")
    db.add(guest)
    db.commit()

    ctx = {"db": db, "college_id": college.id, "canteen_id": canteen.id, "guest_id": guest.id}
    yield ctx

    _purge(db)
    db.close()


def make_item(db, canteen_id, name, price, stock, gst_rate=5):
    item = MenuItem(name=name, price=Decimal(str(price)), stock=stock,
                    canteen_id=canteen_id, is_veg=True, gst_rate=Decimal(str(gst_rate)),
                    prep_time_seconds=60)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def buckets(item_id):
    """Read inventory buckets on a fresh connection (no stale identity map)."""
    db = SessionLocal()
    try:
        it = db.query(MenuItem).filter(MenuItem.id == item_id).first()
        return {"stock": it.stock, "reserved": it.reserved, "committed": it.committed,
                "on_hand": it.on_hand}
    finally:
        db.close()


# ==================================================================
# 1. GST / decimal correctness
# ==================================================================

def test_gst_extracted_from_inclusive_price_not_added():
    s = compute_line_tax(Decimal("10.00"), 4, Decimal("5"))
    assert s["gross_amount"] == Decimal("40.00")
    assert s["taxable_amount"] == Decimal("38.10")
    assert s["cgst_amount"] == Decimal("0.95")
    assert s["sgst_amount"] == Decimal("0.95")
    assert s["total_gst_amount"] == Decimal("1.90")
    # halves must reconstitute the whole exactly
    assert s["cgst_amount"] + s["sgst_amount"] == s["total_gst_amount"]


def test_gst_multiplier_is_dynamic_not_hardcoded():
    assert compute_line_tax(Decimal("118"), 1, 18)["taxable_amount"] == Decimal("100.00")
    assert compute_line_tax(Decimal("112"), 1, 12)["taxable_amount"] == Decimal("100.00")
    assert compute_line_tax(Decimal("107"), 1, 7)["taxable_amount"] == Decimal("100.00")
    assert compute_line_tax(Decimal("100"), 1, 0)["total_gst_amount"] == Decimal("0.00")


def test_decimal_arithmetic_has_no_float_drift():
    total = sum(compute_line_tax(Decimal("0.10"), 1, 5)["gross_amount"] for _ in range(10))
    assert total == Decimal("1.00")   # 0.1*10 in float would be 0.9999999999999999


# ==================================================================
# 2. Atomic inventory + concurrency  (spec §3, §27)
# ==================================================================

def test_20_concurrent_buyers_one_unit_exactly_one_wins(env):
    item = make_item(env["db"], env["canteen_id"], "Vada", 10, stock=1)
    guest_id, canteen_id = env["guest_id"], env["canteen_id"]
    barrier = threading.Barrier(20)
    results = []

    def buy(_):
        barrier.wait()          # maximise the real collision window
        s = SessionLocal()
        try:
            checkout.place_order(
                s, guest_id=guest_id, payment_mode="CASH",
                canteens_payload=[CanteenOrder(canteen_id, [Line(item.id, 1)])],
            )
            s.commit()
            return "OK"
        except TransactionError as e:
            s.rollback()
            return e.code
        except Exception:
            s.rollback()
            return "ERR"
        finally:
            s.close()

    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(buy, range(20)))

    assert results.count("OK") == 1, f"expected exactly 1 winner, got {results.count('OK')}"
    assert results.count(ErrorCode.INSUFFICIENT_STOCK) == 19

    b = buckets(item.id)
    assert b["stock"] == 0
    assert b["reserved"] == 1
    assert b["on_hand"] == 1        # nothing created or destroyed


def test_concurrent_quantity_two_against_five_available_never_oversells(env):
    item = make_item(env["db"], env["canteen_id"], "Puff", 12, stock=5)
    guest_id, canteen_id = env["guest_id"], env["canteen_id"]
    barrier = threading.Barrier(10)

    def buy(_):
        barrier.wait()
        s = SessionLocal()
        try:
            checkout.place_order(
                s, guest_id=guest_id, payment_mode="CASH",
                canteens_payload=[CanteenOrder(canteen_id, [Line(item.id, 2)])],
            )
            s.commit()
            return "OK"
        except TransactionError:
            s.rollback()
            return "REJECTED"
        except Exception:
            s.rollback()
            return "ERR"
        finally:
            s.close()

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(buy, range(10)))

    wins = results.count("OK")
    assert wins == 2, f"5 units / 2 per order => exactly 2 winners, got {wins}"

    b = buckets(item.id)
    assert b["stock"] == 1
    assert b["reserved"] == 4
    assert b["stock"] >= 0
    assert b["on_hand"] == 5


def test_database_check_constraint_blocks_negative_stock(env):
    from sqlalchemy import text
    item = make_item(env["db"], env["canteen_id"], "Guard", 10, stock=1)
    db = SessionLocal()
    try:
        with pytest.raises(Exception):
            db.execute(text("UPDATE menu_items SET stock = -1 WHERE id = :i"), {"i": item.id})
            db.commit()
        db.rollback()
    finally:
        db.close()


# ==================================================================
# 3. Reservation lifecycle + idempotency  (spec §4, §5)
# ==================================================================

def test_release_is_idempotent_never_returns_stock_twice(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Samosa", 15, stock=5)

    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="CASH",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 2)])],
    )
    db.commit()
    order_id = res["orders"][0]["order_id"]

    assert buckets(item.id) == {"stock": 3, "reserved": 2, "committed": 0, "on_hand": 5}

    assert inventory.release_order_reservations(db, order_id) == 1
    db.commit()
    assert buckets(item.id) == {"stock": 5, "reserved": 0, "committed": 0, "on_hand": 5}

    # retry x3 -- must be a complete no-op
    for _ in range(3):
        assert inventory.release_order_reservations(db, order_id) == 0
        db.commit()
    assert buckets(item.id) == {"stock": 5, "reserved": 0, "committed": 0, "on_hand": 5}


def test_commit_is_idempotent_never_commits_twice(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Tea", 10, stock=4)

    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="CASH",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 3)])],
    )
    db.commit()
    order_id = res["orders"][0]["order_id"]

    assert inventory.commit_order_reservations(db, order_id) == 1
    db.commit()
    assert buckets(item.id) == {"stock": 1, "reserved": 0, "committed": 3, "on_hand": 4}

    for _ in range(3):
        assert inventory.commit_order_reservations(db, order_id) == 0
        db.commit()
    assert buckets(item.id) == {"stock": 1, "reserved": 0, "committed": 3, "on_hand": 4}


def test_released_reservation_cannot_be_committed(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Juice", 20, stock=3)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="CASH",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 1)])],
    )
    db.commit()
    reservation = db.query(Reservation).filter(
        Reservation.order_id == res["orders"][0]["order_id"]).first()

    assert inventory.release_reservation(db, reservation) is True
    db.commit()
    db.refresh(reservation)
    assert reservation.status == ReservationStatus.RELEASED.value

    # terminal: commit must not resurrect it
    assert inventory.commit_reservation(db, reservation) is False
    db.commit()
    assert buckets(item.id)["committed"] == 0


def test_expiry_sweeper_returns_stock_without_client_involvement(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Bun", 10, stock=2)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="CASH",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 2)])],
    )
    db.commit()
    reservation = db.query(Reservation).filter(
        Reservation.order_id == res["orders"][0]["order_id"]).first()
    reservation.expires_at = datetime.utcnow() - timedelta(minutes=1)
    db.commit()

    assert buckets(item.id)["stock"] == 0
    assert inventory.expire_due_reservations(db) == 1
    assert buckets(item.id) == {"stock": 2, "reserved": 0, "committed": 0, "on_hand": 2}

    # sweeping again must not double-return
    assert inventory.expire_due_reservations(db) == 0
    assert buckets(item.id)["stock"] == 2


# ==================================================================
# 4. Payment state  (spec §6, §7, §9, §13)
# ==================================================================

def test_upi_order_is_pending_and_holds_stock_until_confirmed(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Dosa", 50, stock=3)

    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="UPI",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 1)])],
    )
    db.commit()

    order_id = res["orders"][0]["order_id"]
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()

    # selecting UPI is NOT payment success
    assert payment.status == PaymentStatus.PENDING.value
    assert payment.provider == "MANUAL"
    assert buckets(item.id) == {"stock": 2, "reserved": 1, "committed": 0, "on_hand": 3}

    out = payment_service.mark_payment_success(
        db, payment, account_id=77, confirmation_method="DEVELOPMENT_MANUAL")
    db.commit()

    assert out["changed"] is True
    assert payment.status == PaymentStatus.SUCCESS.value
    assert payment.confirmed_by_account_id == 77
    assert payment.confirmation_method == "DEVELOPMENT_MANUAL"
    assert buckets(item.id) == {"stock": 2, "reserved": 0, "committed": 1, "on_hand": 3}


def test_double_confirmation_settles_once_and_commits_inventory_once(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Idli", 30, stock=5)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="UPI",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 2)])],
    )
    db.commit()
    payment = db.query(Payment).filter(
        Payment.order_id == res["orders"][0]["order_id"]).first()

    first = payment_service.mark_payment_success(db, payment, account_id=1,
                                                 confirmation_method="DEVELOPMENT_MANUAL")
    db.commit()
    after_first = buckets(item.id)

    for _ in range(3):
        again = payment_service.mark_payment_success(db, payment, account_id=1,
                                                     confirmation_method="DEVELOPMENT_MANUAL")
        db.commit()
        assert again["changed"] is False

    assert first["changed"] is True
    assert buckets(item.id) == after_first == {"stock": 3, "reserved": 0,
                                               "committed": 2, "on_hand": 5}


def test_payment_failure_releases_reservation(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Vada2", 10, stock=4)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="UPI",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 3)])],
    )
    db.commit()
    payment = db.query(Payment).filter(
        Payment.order_id == res["orders"][0]["order_id"]).first()

    assert buckets(item.id)["stock"] == 1
    out = payment_service.mark_payment_failed(db, payment, reason="TEST")
    db.commit()

    assert out["changed"] is True
    assert payment.status == PaymentStatus.FAILED.value
    assert buckets(item.id) == {"stock": 4, "reserved": 0, "committed": 0, "on_hand": 4}

    # retry is a no-op, stock is not returned twice
    assert payment_service.mark_payment_failed(db, payment)["changed"] is False
    db.commit()
    assert buckets(item.id)["stock"] == 4


def test_wallet_debit_is_atomic_and_cannot_go_negative(env):
    from sqlalchemy import text
    db = env["db"]
    item = make_item(db, env["canteen_id"], "WalletItem", 10, stock=100)
    user = User(college_id=env["college_id"], institutional_id="TX1", name="W",
                email="w@x.com", phone="9000000111", password="x",
                wallet_balance=Decimal("25.00"))
    db.add(user)
    db.commit()

    barrier = threading.Barrier(10)

    def buy(_):
        barrier.wait()
        s = SessionLocal()
        try:
            checkout.place_order(
                s, user_id=user.id, payment_mode="WALLET",
                canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 1)])],
            )
            s.commit()
            return "OK"
        except TransactionError:
            s.rollback()
            return "REJECTED"
        except Exception:
            s.rollback()
            return "ERR"
        finally:
            s.close()

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(buy, range(10)))

    db2 = SessionLocal()
    try:
        balance = db2.query(User).filter(User.id == user.id).first().wallet_balance
    finally:
        db2.close()

    # ₹25 balance, ₹10 items => at most 2 purchases, never a negative wallet
    assert results.count("OK") == 2, results
    assert balance == Decimal("5.00")
    assert balance >= 0


# ==================================================================
# 5. Expiry-vs-payment race policy  (spec §14 -- payment wins)
# ==================================================================

def test_payment_after_expiry_rereserves_when_stock_available(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "LateItem", 10, stock=3)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="UPI",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 1)])],
    )
    db.commit()
    order_id = res["orders"][0]["order_id"]

    reservation = db.query(Reservation).filter(Reservation.order_id == order_id).first()
    reservation.expires_at = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    inventory.expire_due_reservations(db)
    assert buckets(item.id) == {"stock": 3, "reserved": 0, "committed": 0, "on_hand": 3}

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    out = payment_service.mark_payment_success(db, payment, account_id=5,
                                               confirmation_method="DEVELOPMENT_MANUAL")
    db.commit()

    assert out["outcome"] == "RECOMMITTED_AFTER_EXPIRY"
    assert buckets(item.id) == {"stock": 2, "reserved": 0, "committed": 1, "on_hand": 3}
    order = db.query(Order).filter(Order.id == order_id).first()
    assert order.status != "NEEDS_RESOLUTION"


def test_payment_after_expiry_parks_order_when_stock_gone(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "GoneItem", 10, stock=1)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="UPI",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 1)])],
    )
    db.commit()
    order_id = res["orders"][0]["order_id"]

    reservation = db.query(Reservation).filter(Reservation.order_id == order_id).first()
    reservation.expires_at = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    inventory.expire_due_reservations(db)

    # somebody else takes the last unit
    assert inventory.try_reserve_stock(db, item.id, 1) is True
    db.commit()
    assert buckets(item.id)["stock"] == 0

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    out = payment_service.mark_payment_success(db, payment, account_id=5,
                                               confirmation_method="DEVELOPMENT_MANUAL")
    db.commit()

    # payment is NOT reversed, order is parked for a human, stock is not
    # double-allocated
    assert out["outcome"] == "NEEDS_RESOLUTION"
    assert payment.status == PaymentStatus.SUCCESS.value
    order = db.query(Order).filter(Order.id == order_id).first()
    assert order.status == "NEEDS_RESOLUTION"
    assert buckets(item.id)["stock"] == 0
    assert buckets(item.id)["on_hand"] == 1


# ==================================================================
# 6. State transition policy  (spec §28)
# ==================================================================

def test_illegal_transitions_are_rejected():
    with pytest.raises(TransactionError):
        assert_payment_transition(PaymentStatus.SUCCESS.value, PaymentStatus.PENDING.value)
    with pytest.raises(TransactionError):
        assert_reservation_transition(ReservationStatus.RELEASED.value,
                                      ReservationStatus.COMMITTED.value)
    with pytest.raises(TransactionError):
        assert_reservation_transition(ReservationStatus.COMMITTED.value,
                                      ReservationStatus.RELEASED.value)
    with pytest.raises(TransactionError):
        assert_order_transition("DELIVERED", "PLACED")


def test_same_state_transition_is_a_safe_noop():
    assert assert_payment_transition(PaymentStatus.SUCCESS.value,
                                     PaymentStatus.SUCCESS.value) is False
    assert assert_order_transition("READY", "READY") is False


# ==================================================================
# 7. Tenant isolation  (spec §19)
# ==================================================================

def test_guest_cannot_order_from_another_colleges_canteen(env):
    db = env["db"]
    other = College(name=TEST_COLLEGE, is_active=True)   # purged by fixture
    db.add(other)
    db.flush()
    other_canteen = Canteen(name="Other", college_id=other.id, is_active=True)
    db.add(other_canteen)
    db.flush()
    other_item = make_item(db, other_canteen.id, "Foreign", 10, stock=10)

    with pytest.raises(TransactionError) as exc:
        checkout.place_order(
            db, guest_id=env["guest_id"], payment_mode="CASH",
            canteens_payload=[CanteenOrder(other_canteen.id, [Line(other_item.id, 1)])],
        )
    db.rollback()
    assert exc.value.code == ErrorCode.UNAUTHORIZED_TENANT


def test_registered_user_cannot_order_across_colleges(env):
    db = env["db"]
    other = College(name=TEST_COLLEGE, is_active=True)
    db.add(other)
    db.flush()
    user = User(college_id=other.id, institutional_id="X1", name="Outsider",
                email="o@x.com", phone="9000000222", password="x",
                wallet_balance=Decimal("500.00"))
    db.add(user)
    db.flush()
    item = make_item(db, env["canteen_id"], "Local", 10, stock=10)

    with pytest.raises(TransactionError) as exc:
        checkout.place_order(
            db, user_id=user.id, payment_mode="WALLET",
            canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 1)])],
        )
    db.rollback()
    assert exc.value.code == ErrorCode.UNAUTHORIZED_TENANT


def test_client_supplied_price_is_ignored_backend_prices_authoritatively(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Priced", 42, stock=5, gst_rate=12)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="CASH",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 2)])],
    )
    db.commit()

    line = db.query(OrderItem).filter(
        OrderItem.order_id == res["orders"][0]["order_id"]).first()
    assert line.unit_price == Decimal("42.00")
    assert line.gross_amount == Decimal("84.00")
    assert line.gst_rate == Decimal("12.00")


# ==================================================================
# 8. Historical immutability  (spec §16)
# ==================================================================

def test_changing_price_and_gst_later_does_not_alter_past_order(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Historic", 10, stock=10, gst_rate=5)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="CASH",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 4)])],
    )
    db.commit()
    order_id = res["orders"][0]["order_id"]

    before = db.query(OrderItem).filter(OrderItem.order_id == order_id).first()
    snapshot = (before.unit_price, before.gst_rate, before.gross_amount,
                before.taxable_amount, before.total_gst_amount)

    item.price = Decimal("99.00")
    item.gst_rate = Decimal("18.00")
    db.commit()

    after = db.query(OrderItem).filter(OrderItem.order_id == order_id).first()
    db.refresh(after)
    assert (after.unit_price, after.gst_rate, after.gross_amount,
            after.taxable_amount, after.total_gst_amount) == snapshot
    assert after.gst_rate == Decimal("5.00")
    assert after.gross_amount == Decimal("40.00")


# ==================================================================
# 9. Crash / rollback safety  (spec §26)
# ==================================================================

def test_failed_checkout_leaves_no_partial_state(env):
    db = env["db"]
    ok_item = make_item(db, env["canteen_id"], "Fine", 10, stock=10)
    short_item = make_item(db, env["canteen_id"], "Short", 10, stock=0)

    before_ok = buckets(ok_item.id)
    orders_before = db.query(Order).count()

    with pytest.raises(TransactionError):
        checkout.place_order(
            db, guest_id=env["guest_id"], payment_mode="CASH",
            canteens_payload=[CanteenOrder(env["canteen_id"],
                                           [Line(ok_item.id, 1), Line(short_item.id, 1)])],
        )
    db.rollback()

    # the first line's reservation must NOT survive the aborted checkout
    assert buckets(ok_item.id) == before_ok
    assert db.query(Order).count() == orders_before


# ==================================================================
# 10. GST rounding invariants (invoice must reconcile exactly)
# ==================================================================

@pytest.mark.parametrize("price,qty,rate", [
    ("10.00", 4, 5), ("10.00", 2, 5), ("15.00", 2, 5), ("118.00", 1, 18),
    ("12.00", 3, 12), ("0.99", 7, 7), ("33.33", 3, 18), ("7.77", 11, 12),
])
def test_cgst_equals_sgst_and_invoice_reconciles(price, qty, rate):
    s = compute_line_tax(Decimal(price), qty, rate)
    # legally required: the two halves are identical
    assert s["cgst_amount"] == s["sgst_amount"]
    # the halves are exactly the total
    assert s["cgst_amount"] + s["sgst_amount"] == s["total_gst_amount"]
    # and the invoice adds up to the penny the customer paid
    assert s["taxable_amount"] + s["total_gst_amount"] == s["gross_amount"]


# ==================================================================
# 11. Sweeper must not reclaim stock from in-progress orders
# ==================================================================

def test_sweeper_does_not_expire_order_already_being_prepared(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Cooking", 10, stock=2)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="CASH",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 2)])],
    )
    db.commit()
    order_id = res["orders"][0]["order_id"]

    # staff accepted it into the kitchen
    order = db.query(Order).filter(Order.id == order_id).first()
    order.status = "PREPARING"
    reservation = db.query(Reservation).filter(Reservation.order_id == order_id).first()
    reservation.expires_at = datetime.utcnow() - timedelta(minutes=30)
    db.commit()

    assert inventory.expire_due_reservations(db) == 0
    # the food stays allocated to that customer
    assert buckets(item.id) == {"stock": 0, "reserved": 2, "committed": 0, "on_hand": 2}


def test_sweeper_does_not_expire_already_paid_order(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Paid", 10, stock=2)
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode="UPI",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 1)])],
    )
    db.commit()
    order_id = res["orders"][0]["order_id"]

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    payment_service.mark_payment_success(db, payment, account_id=9,
                                         confirmation_method="DEVELOPMENT_MANUAL")
    db.commit()

    # even with a stale expiry, a settled order is untouchable
    reservation = db.query(Reservation).filter(Reservation.order_id == order_id).first()
    reservation.expires_at = datetime.utcnow() - timedelta(minutes=30)
    db.commit()

    assert inventory.expire_due_reservations(db) == 0
    assert buckets(item.id)["committed"] == 1


# ==================================================================
# 12. THE INCIDENT: duplicate walk-in orders  (spec §22)
# ==================================================================

import uuid as _uuid

def _k(name):
    """Unique per run -- idempotency keys are durable, so a re-run of the
    suite must not replay the previous run's stored response."""
    return f"{name}-{_uuid.uuid4()}"


def _checkout_via_api(client, body, key):
    return client.post("/order/place", json=body, headers={"Idempotency-Key": key})


@pytest.fixture
def api(env):
    from fastapi.testclient import TestClient
    import app as app_module
    from database import get_db
    from auth import get_current_account, CurrentAccount

    def _override():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    def _fake_manager():
        # /order/place now requires an authenticated actor (customer or
        # Manager/Staff) -- see _resolve_order_actor in orders/router.py.
        # These tests exercise the counter/guest checkout path, so a
        # Manager identity is overridden here rather than going through a
        # real login, matching the QR tests' own `_Account` stand-in.
        return CurrentAccount(
            account_type="staff", account_id=1, role="manager",
            college_id=env["college_id"], canteen_id=None,
        )

    app_module.app.dependency_overrides[get_db] = _override
    app_module.app.dependency_overrides[get_current_account] = _fake_manager
    with TestClient(app_module.app) as c:
        yield c
    app_module.app.dependency_overrides.clear()


def test_incident_retry_with_same_key_creates_exactly_one_order(api, env):
    """The reported failure: submit -> server 'crashes' -> retry x5."""
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Samosa", 15, stock=50)
    body = {"guest_id": env["guest_id"], "payment_mode": "CASH",
            "canteens": [{"canteen_id": env["canteen_id"],
                          "items": [{"menu_item_id": item.id, "quantity": 2}]}]}

    before = db.query(Order).count()
    key = _k("INCIDENT")
    responses = [_checkout_via_api(api, body, key) for _ in range(6)]

    assert all(r.status_code == 200 for r in responses)
    ids = {r.json()["orders"][0]["order_id"] for r in responses}
    assert len(ids) == 1, f"6 retries produced {len(ids)} distinct orders: {ids}"

    db.expire_all()
    assert db.query(Order).count() == before + 1
    order_id = ids.pop()
    assert db.query(Reservation).filter(Reservation.order_id == order_id).count() == 1
    assert db.query(Payment).filter(Payment.order_id == order_id).count() == 1
    assert db.query(OrderVerification).filter(OrderVerification.order_id == order_id).count() == 1
    # 2 units reserved once, not 12
    assert buckets(item.id) == {"stock": 48, "reserved": 2, "committed": 0, "on_hand": 50}


def test_rapid_fire_submissions_without_header_collapse_to_one(api, env):
    """Double/multi-tap with no Idempotency-Key: the auto safety net holds."""
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Tap", 10, stock=50)
    body = {"guest_id": env["guest_id"], "payment_mode": "CASH",
            "canteens": [{"canteen_id": env["canteen_id"],
                          "items": [{"menu_item_id": item.id, "quantity": 2}]}]}

    responses = [api.post("/order/place", json=body) for _ in range(7)]
    ok = [r for r in responses if r.status_code == 200]
    ids = {r.json()["orders"][0]["order_id"] for r in ok}
    assert len(ids) == 1, f"7 rapid submits produced {len(ids)} orders"
    assert buckets(item.id)["reserved"] == 2


def test_different_keys_are_genuinely_different_orders(api, env):
    """Idempotency must not block a real second order."""
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Repeat", 10, stock=50)
    body = {"guest_id": env["guest_id"], "payment_mode": "CASH",
            "canteens": [{"canteen_id": env["canteen_id"],
                          "items": [{"menu_item_id": item.id, "quantity": 1}]}]}

    a = _checkout_via_api(api, body, _k("REAL-A")).json()["orders"][0]["order_id"]
    b = _checkout_via_api(api, body, _k("REAL-B")).json()["orders"][0]["order_id"]
    assert a != b
    assert buckets(item.id)["reserved"] == 2


def test_same_key_different_body_is_rejected(api, env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "KeyGuard", 10, stock=50)
    base = {"guest_id": env["guest_id"], "payment_mode": "CASH",
            "canteens": [{"canteen_id": env["canteen_id"],
                          "items": [{"menu_item_id": item.id, "quantity": 1}]}]}
    other = {**base, "canteens": [{"canteen_id": env["canteen_id"],
                                   "items": [{"menu_item_id": item.id, "quantity": 5}]}]}

    reused = _k("REUSED")
    assert _checkout_via_api(api, base, reused).status_code == 200
    bad = _checkout_via_api(api, other, reused)
    assert bad.status_code == 409
    assert bad.json()["detail"]["code"] == "IDEMPOTENCY_KEY_REUSED"


# ==================================================================
# 12b. CUSTOMER AUTH -- identity comes from the token, never the body
#      (spec CLAUDE.md section 19/34; closes the gap where /order/place,
#      /track-order and /orders/user/history/{id} trusted a client-
#      supplied user_id)
# ==================================================================

from contextlib import contextmanager  # noqa: E402


def _fake_account(account_type, account_id, role, college_id, canteen_id=None):
    from auth import CurrentAccount
    return CurrentAccount(account_type=account_type, account_id=account_id, role=role,
                          college_id=college_id, canteen_id=canteen_id)


@contextmanager
def _client_as(account):
    """A TestClient whose verified identity is fixed to `account`,
    bypassing real JWT issuance the same way the QR tests' `_Account`
    stand-in does -- these tests are about authorization logic, not the
    token format itself."""
    from fastapi.testclient import TestClient
    import app as app_module
    from database import get_db
    from auth import get_current_account

    def _override_db():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    app_module.app.dependency_overrides[get_db] = _override_db
    if account is not None:
        app_module.app.dependency_overrides[get_current_account] = lambda: account
    try:
        with TestClient(app_module.app) as client:
            yield client
    finally:
        app_module.app.dependency_overrides.clear()


def _make_customer(db, college_id, phone, wallet_balance="0"):
    user = User(college_id=college_id, institutional_id=f"INST-{phone}", name=f"User {phone}",
                email=f"{phone}@example.com", phone=phone, password="not-a-real-hash",
                role="student", wallet_balance=Decimal(wallet_balance))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_order_place_rejects_unauthenticated_caller(env):
    """No Authorization header at all. Anonymous checkout must not be
    possible -- neither as a customer nor as a walk-in."""
    body = {"guest_id": env["guest_id"], "payment_mode": "CASH",
            "canteens": [{"canteen_id": env["canteen_id"], "items": []}]}
    with _client_as(None) as client:
        r = client.post("/order/place", json=body)
        assert r.status_code in (401, 403)


def test_customer_token_cannot_place_guest_order(env):
    """A registered customer's token must not be usable to create a
    walk-in guest order -- that path is Manager/Staff only."""
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Puff", 10, stock=10)
    customer = _make_customer(db, env["college_id"], "9000000001")

    body = {"guest_id": env["guest_id"], "payment_mode": "CASH",
            "canteens": [{"canteen_id": env["canteen_id"],
                          "items": [{"menu_item_id": item.id, "quantity": 1}]}]}
    account = _fake_account("customer", customer.id, "student", env["college_id"])
    with _client_as(account) as client:
        r = client.post("/order/place", json=body, headers={"Idempotency-Key": _k("CUST-AS-GUEST")})
        assert r.status_code == 403


def test_staff_token_cannot_place_customer_order(env):
    """The counter path is guest-only -- a Manager/Staff token must not
    be able to place an order (and spend wallet funds) as a registered
    customer either."""
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Lassi", 10, stock=10)
    customer = _make_customer(db, env["college_id"], "9000000002", wallet_balance="500")

    body = {"user_id": customer.id, "payment_mode": "WALLET",
            "canteens": [{"canteen_id": env["canteen_id"],
                          "items": [{"menu_item_id": item.id, "quantity": 1}]}]}
    account = _fake_account("staff", 1, "manager", env["college_id"])
    with _client_as(account) as client:
        r = client.post("/order/place", json=body, headers={"Idempotency-Key": _k("STAFF-AS-CUST")})
        assert r.status_code == 403


def test_customer_supplied_user_id_is_ignored_not_trusted(env):
    """The core fix: a logged-in customer cannot spend another
    customer's wallet balance by putting that customer's id in the
    request body. The order must be attributed to the TOKEN's account,
    and the victim's wallet must be untouched."""
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Bun", 10, stock=10)
    victim = _make_customer(db, env["college_id"], "9000000003", wallet_balance="500")
    attacker = _make_customer(db, env["college_id"], "9000000004", wallet_balance="0")

    body = {"user_id": victim.id, "payment_mode": "WALLET",
            "canteens": [{"canteen_id": env["canteen_id"],
                          "items": [{"menu_item_id": item.id, "quantity": 1}]}]}
    account = _fake_account("customer", attacker.id, "student", env["college_id"])
    with _client_as(account) as client:
        r = client.post("/order/place", json=body, headers={"Idempotency-Key": _k("SPOOF-USER-ID")})

    # Attacker has no wallet balance, so if the server had trusted the
    # body's user_id (the funded victim) instead of the token, this
    # would have succeeded. It must fail, and the victim's money must
    # be untouched either way.
    assert r.status_code != 200
    db.expire_all()
    assert db.query(User).filter(User.id == victim.id).first().wallet_balance == Decimal("500.00")


def test_track_order_is_scoped_to_its_own_customer(env):
    """A customer must not be able to read another customer's order --
    including its pickup verification token -- by guessing an order_id."""
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Wrap", 10, stock=10)
    owner = _make_customer(db, env["college_id"], "9000000005")
    stranger = _make_customer(db, env["college_id"], "9000000006")

    result = checkout.place_order(
        db, user_id=owner.id, payment_mode="CASH",
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, 1)])],
    )
    db.commit()
    order_id = result["orders"][0]["order_id"]

    with _client_as(_fake_account("customer", stranger.id, "student", env["college_id"])) as client:
        r = client.get(f"/track-order/{order_id}")
        assert r.status_code == 403

    with _client_as(_fake_account("customer", owner.id, "student", env["college_id"])) as client:
        r = client.get(f"/track-order/{order_id}")
        assert r.status_code == 200
        assert r.json()["order_id"] == order_id
        assert r.json()["verification_token"] == result["orders"][0]["verification_token"]


def test_order_history_is_scoped_to_its_own_customer(env):
    """/orders/user/history/{user_id} must reject a mismatched token
    identity rather than trusting the path parameter."""
    owner = _make_customer(env["db"], env["college_id"], "9000000007")
    stranger = _make_customer(env["db"], env["college_id"], "9000000008")

    with _client_as(_fake_account("customer", stranger.id, "student", env["college_id"])) as client:
        r = client.get(f"/orders/user/history/{owner.id}")
        assert r.status_code == 403

    with _client_as(_fake_account("customer", owner.id, "student", env["college_id"])) as client:
        r = client.get(f"/orders/user/history/{owner.id}")
        assert r.status_code == 200


def test_real_login_issues_a_token_that_actually_works(env):
    """
    End-to-end with NO dependency overrides for auth: a real password
    hash, a real POST /users/login, a real JWT, used to place a real
    order and read it back. This is the one test that would catch a
    mistake in auth.py/decode_access_token itself, which every other
    customer-auth test above bypasses via _client_as().
    """
    from fastapi.testclient import TestClient
    import app as app_module
    from database import get_db
    from security import hash_password

    db = env["db"]
    item = make_item(db, env["canteen_id"], "Cutlet", 12, stock=10)

    user = User(college_id=env["college_id"], institutional_id="REAL-1", name="Real User",
                email="real@example.com", phone="9000000099",
                password=hash_password("correct-horse"), role="student",
                wallet_balance=Decimal("100"))
    db.add(user)
    db.commit()
    db.refresh(user)

    def _override_db():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    app_module.app.dependency_overrides[get_db] = _override_db
    try:
        with TestClient(app_module.app) as client:
            login = client.post("/users/login", json={
                "college_id": env["college_id"], "phone": "9000000099", "password": "correct-horse",
            })
            assert login.status_code == 200
            tokens = login.json()
            assert tokens["access_token"] and tokens["refresh_token"]

            headers = {"Authorization": f"Bearer {tokens['access_token']}"}

            place = client.post(
                "/order/place",
                json={"payment_mode": "WALLET",
                      "canteens": [{"canteen_id": env["canteen_id"],
                                    "items": [{"menu_item_id": item.id, "quantity": 1}]}]},
                headers={**headers, "Idempotency-Key": _k("REAL-LOGIN")},
            )
            assert place.status_code == 200
            order_id = place.json()["orders"][0]["order_id"]

            track = client.get(f"/track-order/{order_id}", headers=headers)
            assert track.status_code == 200
            assert track.json()["order_id"] == order_id

            # Wrong password on a fresh call must still fail normally.
            bad_login = client.post("/users/login", json={
                "college_id": env["college_id"], "phone": "9000000099", "password": "wrong",
            })
            assert bad_login.status_code == 401

            # No token at all must be rejected.
            anon = client.get(f"/track-order/{order_id}")
            assert anon.status_code in (401, 403)
    finally:
        app_module.app.dependency_overrides.clear()


# ==================================================================
# 13. QR VERIFICATION MATRIX  (spec §10-§15, §23)
# ==================================================================

class _Account:
    """Stand-in for the verified JWT identity."""
    def __init__(self, college_id, canteen_id, role="delivery", account_id=99):
        self.account_type = "staff"
        self.account_id = account_id
        self.role = role
        self.college_id = college_id
        self.canteen_id = canteen_id


def _place(db, env, item, qty=1, mode="CASH"):
    res = checkout.place_order(
        db, guest_id=env["guest_id"], payment_mode=mode,
        canteens_payload=[CanteenOrder(env["canteen_id"], [Line(item.id, qty)])],
    )
    db.commit()
    return res["orders"][0]


def test_qr_token_resolves_to_exactly_its_own_order(env):
    from modules.verification.router import scan_qr_payload, QRScanRequest
    db = env["db"]
    item = make_item(db, env["canteen_id"], "QRItem", 10, stock=20)

    a = _place(db, env, item)
    b = _place(db, env, item)
    assert a["order_id"] != b["order_id"]
    assert a["verification_token"] != b["verification_token"]

    acct = _Account(env["college_id"], env["canteen_id"])

    ra = scan_qr_payload(QRScanRequest(payload=a["verification_token"]), acct, db)
    assert ra["order_id"] == a["order_id"]

    rb = scan_qr_payload(QRScanRequest(payload=b["verification_token"]), acct, db)
    assert rb["order_id"] == b["order_id"]
    # same guest, two orders -> two distinct QRs that never cross over
    assert ra["order_id"] != rb["order_id"]


def test_qr_cannot_be_replayed(env):
    from fastapi import HTTPException
    from modules.verification.router import scan_qr_payload, QRScanRequest
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Replay", 10, stock=10)
    order = _place(db, env, item)
    acct = _Account(env["college_id"], env["canteen_id"])

    assert scan_qr_payload(QRScanRequest(payload=order["verification_token"]), acct, db)["order_id"] == order["order_id"]

    with pytest.raises(HTTPException) as exc:
        scan_qr_payload(QRScanRequest(payload=order["verification_token"]), acct, db)
    assert exc.value.status_code == 409
    assert "already been verified" in str(exc.value.detail)


def test_unknown_qr_is_rejected(env):
    from fastapi import HTTPException
    from modules.verification.router import scan_qr_payload, QRScanRequest
    db = env["db"]
    acct = _Account(env["college_id"], env["canteen_id"])
    with pytest.raises(HTTPException) as exc:
        scan_qr_payload(QRScanRequest(payload="totally-made-up-token"), acct, db)
    assert exc.value.status_code == 404


def test_qr_from_another_tenant_is_rejected(env):
    from fastapi import HTTPException
    from modules.verification.router import scan_qr_payload, QRScanRequest
    db = env["db"]
    item = make_item(db, env["canteen_id"], "TenantQR", 10, stock=10)
    order = _place(db, env, item)

    # a courier from a different college/canteen scans it
    foreign = _Account(college_id=env["college_id"] + 9999, canteen_id=env["canteen_id"] + 9999)
    with pytest.raises(HTTPException) as exc:
        scan_qr_payload(QRScanRequest(payload=order["verification_token"]), foreign, db)
    assert exc.value.status_code == 403


def test_staff_from_another_canteen_same_college_is_rejected(env):
    from fastapi import HTTPException
    from modules.verification.router import scan_qr_payload, QRScanRequest
    db = env["db"]
    item = make_item(db, env["canteen_id"], "OtherCanteen", 10, stock=10)
    order = _place(db, env, item)

    other = _Account(env["college_id"], canteen_id=env["canteen_id"] + 777, role="delivery")
    with pytest.raises(HTTPException) as exc:
        scan_qr_payload(QRScanRequest(payload=order["verification_token"]), other, db)
    assert exc.value.status_code == 403


def test_delivered_order_qr_is_rejected(env):
    from fastapi import HTTPException
    from modules.verification.router import scan_qr_payload, QRScanRequest
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Done", 10, stock=10)
    order = _place(db, env, item)

    o = db.query(Order).filter(Order.id == order["order_id"]).first()
    o.status = "DELIVERED"
    db.commit()

    acct = _Account(env["college_id"], env["canteen_id"])
    with pytest.raises(HTTPException) as exc:
        scan_qr_payload(QRScanRequest(payload=order["verification_token"]), acct, db)
    assert exc.value.status_code == 409
    assert "DELIVERED" in str(exc.value.detail)


def test_cancelled_order_qr_is_rejected(env):
    from fastapi import HTTPException
    from modules.verification.router import scan_qr_payload, QRScanRequest
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Cancelled", 10, stock=10)
    order = _place(db, env, item)

    o = db.query(Order).filter(Order.id == order["order_id"]).first()
    o.status = "CANCELLED"
    db.commit()

    acct = _Account(env["college_id"], env["canteen_id"])
    with pytest.raises(HTTPException) as exc:
        scan_qr_payload(QRScanRequest(payload=order["verification_token"]), acct, db)
    assert exc.value.status_code == 409


def test_legacy_mobile_order_id_payload_still_verifies(env):
    """The mobile app's existing {"order_id": N} QR must keep working."""
    import json as _json
    from modules.verification.router import scan_qr_payload, QRScanRequest
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Legacy", 10, stock=10)
    order = _place(db, env, item)

    acct = _Account(env["college_id"], env["canteen_id"])
    result = scan_qr_payload(
        QRScanRequest(payload=_json.dumps({"order_id": order["order_id"]})), acct, db)
    assert result["order_id"] == order["order_id"]


def test_walkin_qr_payload_is_opaque_not_guessable_identity(env):
    """The walk-in QR must not encode order_id / guest / phone."""
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Opaque", 10, stock=10)
    order = _place(db, env, item)
    token = order["verification_token"]

    guest = db.query(GuestCustomer).filter(GuestCustomer.id == env["guest_id"]).first()
    assert str(order["order_id"]) not in token
    assert guest.phone not in token
    assert guest.guest_code not in token
    assert len(token) >= 24


# ==================================================================
# 14. Central state policy is actually enforced at the endpoints
# ==================================================================

def test_apply_order_status_rejects_illegal_move(env):
    from modules.transactions.state import apply_order_status
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Flow", 10, stock=5)
    order_id = _place(db, env, item)["order_id"]
    order = db.query(Order).filter(Order.id == order_id).first()

    assert apply_order_status(order, "PREPARING") is True
    assert apply_order_status(order, "READY") is True
    assert apply_order_status(order, "DELIVERED") is True

    # terminal: cannot go backwards
    with pytest.raises(TransactionError) as exc:
        apply_order_status(order, "PREPARING")
    assert exc.value.code == ErrorCode.INVALID_STATE_TRANSITION
    assert order.status == "DELIVERED"
    db.commit()


def test_apply_order_status_same_state_is_noop(env):
    from modules.transactions.state import apply_order_status
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Noop", 10, stock=5)
    order = db.query(Order).filter(Order.id == _place(db, env, item)["order_id"]).first()
    assert apply_order_status(order, "PLACED") is False
    assert order.status == "PLACED"
    db.rollback()


def test_admin_stats_uses_snapshot_not_live_price(env):
    """Editing a price must not rewrite yesterday's revenue."""
    from modules.admin.router import get_admin_stats
    db = env["db"]
    item = make_item(db, env["canteen_id"], "StatItem", 20, stock=10)
    _place(db, env, item, qty=2)          # revenue 40.00 at sale time

    acct = _Account(env["college_id"], env["canteen_id"], role="manager")
    before = get_admin_stats(env["canteen_id"], acct, db)

    item.price = Decimal("999.00")
    db.commit()

    after = get_admin_stats(env["canteen_id"], acct, db)
    assert before["total_revenue"] == 40.0
    assert after["total_revenue"] == before["total_revenue"]


# ==================================================================
# 15. Webhook idempotency + reconciliation safety  (§10, §12)
# ==================================================================

def test_duplicate_provider_event_is_recorded_once(env):
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Hook", 10, stock=5)
    order = _place(db, env, item, mode="UPI")
    payment = db.query(Payment).filter(Payment.order_id == order["order_id"]).first()

    first = payment_service.record_provider_event(db, "TESTPSP", "evt-123", "SUCCESS", payment.id)
    db.commit()
    second = payment_service.record_provider_event(db, "TESTPSP", "evt-123", "SUCCESS", payment.id)
    db.commit()

    assert first is True
    assert second is False, "the same provider event must not be processed twice"


def test_duplicate_webhook_cannot_double_commit_inventory(env):
    """Simulates the provider delivering the same SUCCESS event 4 times."""
    db = env["db"]
    item = make_item(db, env["canteen_id"], "HookInv", 10, stock=6)
    order = _place(db, env, item, qty=2, mode="UPI")
    payment = db.query(Payment).filter(Payment.order_id == order["order_id"]).first()

    applied = 0
    for _ in range(4):
        if payment_service.record_provider_event(db, "TESTPSP", "evt-dup", "SUCCESS", payment.id):
            payment_service.mark_payment_success(db, payment, confirmation_method="GATEWAY_WEBHOOK")
            applied += 1
        db.commit()

    assert applied == 1
    assert buckets(item.id) == {"stock": 4, "reserved": 0, "committed": 2, "on_hand": 6}


def test_reconciliation_never_invents_an_outcome(env):
    """With no gateway, a PENDING payment must NOT be guessed either way."""
    from modules.payments import reconciliation
    db = env["db"]
    item = make_item(db, env["canteen_id"], "Recon", 10, stock=5)
    order = _place(db, env, item, mode="UPI")
    payment = db.query(Payment).filter(Payment.order_id == order["order_id"]).first()

    # backdate so it looks stuck
    payment.created_at = datetime.utcnow() - timedelta(hours=2)
    db.commit()

    report = reconciliation.reconcile_pending_payments(db, older_than_minutes=15)
    db.refresh(payment)

    assert report["examined"] >= 1
    assert report["settled"] == 0
    assert report["failed"] == 0
    assert payment.status == PaymentStatus.PENDING.value, "must stay PENDING, not be guessed"
    mine = [r for r in report["results"] if r["payment_id"] == payment.id][0]
    assert mine["action"] == "NONE"
    assert mine["provider_status"] == "UNAVAILABLE"

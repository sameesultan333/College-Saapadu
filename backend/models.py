from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Numeric,
    Boolean,
    ForeignKey,
    DateTime,
    Time,
    Enum,
    UniqueConstraint,
    CheckConstraint,
    Index,
    Text,
)

from database import Base
from datetime import datetime
import enum

# Authoritative monetary values use NUMERIC, never binary floating point.
# Money(12,2) holds up to 9,999,999,999.99 -- far beyond canteen scale --
# with exact 2-decimal arithmetic. Rates use 5,2 (e.g. 18.00 %).
Money = Numeric(12, 2)
Rate = Numeric(5, 2)


# ============================================================
# PREPARATION TYPE
# ============================================================

class PrepType(str, enum.Enum):
    RA = "RA"
    COOK = "COOK"


class StaffRole(str, enum.Enum):
    MANAGER = "manager"
    STAFF = "staff"
    DELIVERY = "delivery"


class GuestCategory(str, enum.Enum):
    """Who a walk-in guest actually is. A guest is never a verified
    account, so this is self-declared by the customer to the counter
    staff -- purely informational (kitchen/delivery display), never a
    trust or authorization signal."""
    STUDENT = "STUDENT"
    PARENT = "PARENT"
    STAFF = "STAFF"


class VerificationStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    USED = "USED"
    CANCELLED = "CANCELLED"


class ReservationStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMMITTED = "COMMITTED"
    RELEASED = "RELEASED"
    EXPIRED = "EXPIRED"


class PaymentStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


# ============================================================
# COMPANY ADMIN
# ============================================================

class CompanyAdmin(Base):
    __tablename__ = "company_admins"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    email = Column(
        String,
        unique=True,
        nullable=True,
        index=True
    )

    phone = Column(
        String,
        unique=True,
        nullable=True,
        index=True
    )

    password = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# COLLEGE
# ============================================================

class College(Base):
    __tablename__ = "colleges"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# CANTEEN
# ============================================================

class Canteen(Base):
    __tablename__ = "canteens"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    location = Column(
        String
    )

    college_id = Column(
        Integer,
        ForeignKey("colleges.id"),
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True
    )

    # Daily opening/closing time-of-day. Nullable -- a canteen with no
    # hours set yet just doesn't show a schedule (no fabricated default),
    # same "don't show a guess" principle as the mobile crowd meter.
    opens_at = Column(
        Time,
        nullable=True
    )

    closes_at = Column(
        Time,
        nullable=True
    )


# ============================================================
# STAFF ACCOUNT (College Manager + Canteen Staff)
# ============================================================
# canteen_id is NULL for a Manager (college-wide scope) and set
# for a Staff account (scoped to exactly one canteen).

class StaffAccount(Base):
    __tablename__ = "staff_accounts"
    # Phone is globally unique across colleges now, not per-college -- same
    # reasoning as User.phone above: /staff/login takes phone + password
    # only, no college_id, so the phone alone must resolve to one account.

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    college_id = Column(
        Integer,
        ForeignKey("colleges.id"),
        nullable=False
    )

    canteen_id = Column(
        Integer,
        ForeignKey("canteens.id"),
        nullable=True
    )

    name = Column(
        String,
        nullable=False
    )

    # Employee/staff identifier the manager assigns when creating the
    # account (e.g. a canteen's internal staff code) -- distinct from
    # User.institutional_id, which identifies mobile customers. Nullable at
    # the database level (existing rows predate this field, added via the
    # lightweight migration in app.py) even though the create-staff flow
    # requires it going forward.
    staff_id = Column(
        String,
        nullable=True
    )

    phone = Column(
        String,
        nullable=False,
        unique=True,
        index=True
    )

    password = Column(
        String,
        nullable=False
    )

    role = Column(
        Enum(StaffRole),
        nullable=False,
        default=StaffRole.STAFF
    )

    is_active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# REFRESH TOKEN
# ============================================================
# Backs the JWT access/refresh flow for StaffAccount and
# CompanyAdmin logins. Stores a hash of the token, never the
# raw value. Rotated on every refresh; revoked_at marks logout.

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    token_hash = Column(
        String,
        nullable=False,
        unique=True,
        index=True
    )

    account_type = Column(
        String,
        nullable=False
    )

    account_id = Column(
        Integer,
        nullable=False
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )

    revoked_at = Column(
        DateTime,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# USER
# ============================================================

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        # institutional_id stays college-scoped (23CSE1042 can exist at two
        # different colleges) -- only phone changed. Login now identifies
        # the account by phone alone with no college_id from the client, so
        # phone must be unique across the whole platform, not per-college
        # (explicit product decision -- see CLAUDE.md; previously it was
        # intentionally UNIQUE(college_id, phone) to allow the same number
        # at two colleges).
        UniqueConstraint("college_id", "institutional_id", name="uq_user_college_institutional_id"),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    college_id = Column(
        Integer,
        ForeignKey("colleges.id"),
        nullable=False
    )

    institutional_id = Column(
        String,
        nullable=False,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        nullable=False
    )

    phone = Column(
        String,
        nullable=False,
        unique=True,
        index=True
    )

    password = Column(
        String,
        nullable=False
    )

    wallet_balance = Column(
        Money,
        nullable=False,
        default=0
    )

    role = Column(
        String,
        default="student"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# GUEST CUSTOMER (Walk-in, no app account)
# ============================================================
# A separate identity from User -- never a fake registered account.
# guest_code is the human-facing generated identifier (e.g. "G-8F42K7"),
# deliberately not the phone number. id is the internal FK target used
# by Order.guest_id, mirroring how Order.user_id references User.id.

class GuestCustomer(Base):
    __tablename__ = "guest_customers"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    guest_code = Column(
        String,
        nullable=False,
        unique=True,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    phone = Column(
        String,
        nullable=False
    )

    # Self-declared by the walk-in customer at the counter (see
    # GuestCategory) -- distinguishes a student from a visiting parent or
    # a staff member ordering as a guest, for kitchen/delivery display
    # only. Defaults to STUDENT since that is overwhelmingly the common
    # case and existing rows predate this column.
    category = Column(
        Enum(GuestCategory),
        nullable=False,
        default=GuestCategory.STUDENT
    )

    college_id = Column(
        Integer,
        ForeignKey("colleges.id"),
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# MENU ITEM
# ============================================================

class MenuItem(Base):
    __tablename__ = "menu_items"
    # The database itself refuses to hold a negative inventory bucket, so
    # even a bug in application code cannot oversell -- the transaction
    # aborts instead.
    __table_args__ = (
        CheckConstraint("stock >= 0", name="ck_menu_items_stock_non_negative"),
        CheckConstraint("reserved >= 0", name="ck_menu_items_reserved_non_negative"),
        CheckConstraint("committed >= 0", name="ck_menu_items_committed_non_negative"),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String
    )

    price = Column(
        Money
    )

    # INVENTORY BUCKETS
    # `stock` is the AVAILABLE bucket -- units still sellable right now.
    # It is what managers edit and what the menu API exposes, so the name
    # is kept for API/UI compatibility.
    #
    #   on_hand   = stock + reserved + committed   (derived, see property)
    #   available = stock
    #
    # Reserving moves units stock -> reserved. Committing moves them
    # reserved -> committed. Releasing moves them reserved -> stock.
    # Every move is a single atomic, guarded UPDATE (see modules/inventory).
    stock = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0"
    )

    reserved = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0"
    )

    committed = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0"
    )

    @property
    def available(self) -> int:
        return self.stock or 0

    @property
    def on_hand(self) -> int:
        return (self.stock or 0) + (self.reserved or 0) + (self.committed or 0)

    is_veg = Column(
        Boolean,
        default=True
    )

    canteen_id = Column(
        Integer,
        ForeignKey("canteens.id")
    )

    prep_type = Column(
        Enum(PrepType),
        default=PrepType.RA
    )

    prep_time_seconds = Column(
        Integer,
        default=60
    )

    # GST percentage applied to this item's (GST-inclusive) price.
    # Changing this affects FUTURE orders only -- every OrderItem keeps
    # its own historical snapshot of the rate it was sold under.
    gst_rate = Column(
        Rate,
        nullable=False,
        default=5.0
    )


# ============================================================
# ORDER
# ============================================================

class Order(Base):
    __tablename__ = "orders"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Exactly one of user_id / guest_id is set -- enforced in the order
    # placement logic, not a DB constraint (mirrors the rest of this
    # codebase's style of app-level validation over CHECK constraints).
    user_id = Column(
        Integer,
        nullable=True
    )

    guest_id = Column(
        Integer,
        ForeignKey("guest_customers.id"),
        nullable=True
    )

    canteen_id = Column(
        Integer,
        ForeignKey("canteens.id")
    )

    # Fulfilment lifecycle. Existing values (PLACED/PREPARING/READY/
    # DELIVERED) are unchanged because dashboards and the mobile app
    # depend on them. NEEDS_RESOLUTION is added for the payment-succeeded-
    # but-stock-gone case (see modules/payments/service.py).
    status = Column(
        String,
        default="PLACED"
    )

    # Payment lifecycle, deliberately SEPARATE from `status`. A single
    # field cannot express "order is PREPARING but payment still PENDING".
    payment_status = Column(
        String,
        nullable=False,
        default=PaymentStatus.NOT_STARTED.value,
        server_default=PaymentStatus.NOT_STARTED.value
    )

    payment_mode = Column(
        String
    )

    # Authoritative order total, snapshotted from the order items at
    # creation. Never recomputed from the live menu.
    total_amount = Column(
        Money,
        nullable=True
    )

    estimated_wait_time = Column(
        Integer
    )

    estimated_ready_at = Column(
        Integer
    )

    order_type = Column(
        String
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# ORDER ITEM
# ============================================================

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False
    )

    menu_item_id = Column(
        Integer,
        ForeignKey("menu_items.id"),
        nullable=False
    )

    quantity = Column(
        Integer,
        nullable=False
    )

    # ------------------------------------------------------------
    # IMMUTABLE FINANCIAL SNAPSHOT
    # ------------------------------------------------------------
    # Captured once, at order placement, from the MenuItem as it was
    # priced/taxed at that moment. Reports MUST read these columns and
    # never re-derive money from the live MenuItem, so that changing an
    # item's price or GST rate later cannot rewrite past financial
    # records. Nullable only because rows created before this feature
    # existed have no snapshot -- the report layer falls back to live
    # MenuItem values for those and flags them as estimated.
    unit_price = Column(
        Money,
        nullable=True
    )

    gst_rate = Column(
        Rate,
        nullable=True
    )

    gross_amount = Column(
        Money,
        nullable=True
    )

    taxable_amount = Column(
        Money,
        nullable=True
    )

    cgst_amount = Column(
        Money,
        nullable=True
    )

    sgst_amount = Column(
        Money,
        nullable=True
    )

    total_gst_amount = Column(
        Money,
        nullable=True
    )


# ============================================================
# ORDER VERIFICATION
# ============================================================
# One-per-order secure token backing QR-based pickup verification.
# The QR encodes only `token` -- never customer name/phone/order
# contents. The backend is the sole authority on whether a token is
# valid; a delivery/staff client must call the verify endpoint rather
# than trusting anything it decodes client-side.

class OrderVerification(Base):
    __tablename__ = "order_verifications"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False,
        unique=True
    )

    token = Column(
        String,
        nullable=False,
        unique=True,
        index=True
    )

    status = Column(
        Enum(VerificationStatus),
        nullable=False,
        default=VerificationStatus.ACTIVE
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    used_at = Column(
        DateTime,
        nullable=True
    )

    used_by_account_id = Column(
        Integer,
        nullable=True
    )



# ============================================================
# RESERVATION
# ============================================================
# A durable record of inventory held for one order line. Inventory is
# only ever moved between buckets alongside a status change here, so the
# ledger and the buckets cannot drift.
#
#   ACTIVE -> COMMITTED   (payment succeeded)
#   ACTIVE -> RELEASED    (payment failed / order cancelled)
#   ACTIVE -> EXPIRED     (timeout swept)
#
# COMMITTED and RELEASED are terminal: no transition leaves them. Every
# transition is a guarded UPDATE matching on the current status, which is
# what makes release/commit idempotent under retries.

class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_reservations_quantity_positive"),
        Index("ix_reservations_order", "order_id"),
        Index("ix_reservations_status_expiry", "status", "expires_at"),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False
    )

    menu_item_id = Column(
        Integer,
        ForeignKey("menu_items.id"),
        nullable=False
    )

    quantity = Column(
        Integer,
        nullable=False
    )

    status = Column(
        String,
        nullable=False,
        default=ReservationStatus.ACTIVE.value,
        server_default=ReservationStatus.ACTIVE.value
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # Timeout is configuration, not a hardcoded business rule --
    # see RESERVATION_TTL_MINUTES in config.py.
    expires_at = Column(
        DateTime,
        nullable=True
    )

    committed_at = Column(
        DateTime,
        nullable=True
    )

    released_at = Column(
        DateTime,
        nullable=True
    )


# ============================================================
# PAYMENT
# ============================================================
# One payment attempt per order. Provider fields are populated by a real
# gateway later; the development/manual provider fills provider="MANUAL"
# and records who confirmed it.

class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("provider", "provider_payment_id",
                         name="uq_payments_provider_reference"),
        Index("ix_payments_order", "order_id"),
        Index("ix_payments_status", "status"),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False
    )

    amount = Column(
        Money,
        nullable=False
    )

    status = Column(
        String,
        nullable=False,
        default=PaymentStatus.NOT_STARTED.value,
        server_default=PaymentStatus.NOT_STARTED.value
    )

    method = Column(
        String,
        nullable=True
    )

    # "MANUAL" today (development/staff confirmation); a real gateway
    # name once integrated. Kept alongside provider_payment_id so the
    # uniqueness constraint scopes references per provider.
    provider = Column(
        String,
        nullable=True
    )

    provider_payment_id = Column(
        String,
        nullable=True
    )

    # Audit trail for the development/manual confirmation path.
    confirmation_method = Column(
        String,
        nullable=True
    )

    confirmed_by_account_id = Column(
        Integer,
        nullable=True
    )

    confirmed_at = Column(
        DateTime,
        nullable=True
    )

    failure_reason = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )


# ============================================================
# PAYMENT EVENT
# ============================================================
# Webhook/provider-callback idempotency ledger. A provider may deliver
# the same event repeatedly, out of order, or after a server restart;
# the UNIQUE constraint on (provider, provider_event_id) means the second
# delivery cannot re-apply a state change.

class PaymentEvent(Base):
    __tablename__ = "payment_events"
    __table_args__ = (
        UniqueConstraint("provider", "provider_event_id",
                         name="uq_payment_events_provider_event"),
        Index("ix_payment_events_payment", "payment_id"),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    payment_id = Column(
        Integer,
        ForeignKey("payments.id"),
        nullable=True
    )

    provider = Column(
        String,
        nullable=False
    )

    provider_event_id = Column(
        String,
        nullable=False
    )

    event_type = Column(
        String,
        nullable=True
    )

    received_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    processed_at = Column(
        DateTime,
        nullable=True
    )


# ============================================================
# IDEMPOTENCY KEY
# ============================================================
# Durable checkout de-duplication. A lost response followed by a client
# retry must return the FIRST result, not create a second order. The
# UNIQUE constraint on `key` is what enforces this -- two concurrent
# retries race to insert, exactly one wins, the loser reads the winner's
# result. Frontend button-disabling is not a substitute.

class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("key", name="uq_idempotency_key"),
        Index("ix_idempotency_created", "created_at"),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    key = Column(
        String,
        nullable=False
    )

    scope = Column(
        String,
        nullable=False
    )

    # Hash of the request body: the same key sent with a DIFFERENT
    # payload is a client bug, and is rejected rather than silently
    # returning someone else's result.
    request_hash = Column(
        String,
        nullable=True
    )

    status = Column(
        String,
        nullable=False,
        default="IN_PROGRESS",
        server_default="IN_PROGRESS"
    )

    response_body = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    completed_at = Column(
        DateTime,
        nullable=True
    )

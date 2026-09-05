import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import OrderVerification, VerificationStatus, Order, Canteen, GuestCustomer, User
from auth import require_operational_account, require_staff_or_manager, assert_canteen_in_scope, CurrentAccount


log = logging.getLogger("verification")

router = APIRouter(
    prefix="/verification",
    tags=["Verification"]
)


class QRScanRequest(BaseModel):
    """Raw string the delivery scanner decoded from the camera."""
    payload: str


def _order_and_canteen_or_404(db: Session, order_id: int):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    canteen = db.query(Canteen).filter(Canteen.id == order.canteen_id).first()
    if not canteen:
        raise HTTPException(status_code=404, detail="Canteen not found")

    return order, canteen


def _customer_label(db: Session, order: Order) -> str:
    if order.user_id:
        user = db.query(User).filter(User.id == order.user_id).first()
        return user.name if user else "Registered customer"
    if order.guest_id:
        guest = db.query(GuestCustomer).filter(GuestCustomer.id == order.guest_id).first()
        return f"{guest.name} (Guest {guest.guest_code})" if guest else "Guest"
    return "Unknown"


# ============================================================
# VERIFY (Delivery/Staff/Manager scan-and-check -- "allow handover")
# ============================================================
# The backend is the sole authority on validity. A client must never
# treat a decoded QR payload as proof by itself -- it must call this
# endpoint and act on the response.

@router.post("/{token}/verify")
def verify_order_token(
    token: str,
    account: CurrentAccount = Depends(require_operational_account),
    db: Session = Depends(get_db)
):
    verification = db.query(OrderVerification).filter(OrderVerification.token == token).first()

    if not verification:
        raise HTTPException(status_code=404, detail="Invalid QR")

    order, canteen = _order_and_canteen_or_404(db, verification.order_id)

    # Tenant/scope check before revealing anything about verification state.
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    if verification.status == VerificationStatus.USED:
        raise HTTPException(status_code=409, detail="This order has already been verified/handed over")

    if verification.status == VerificationStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="This order's verification has been cancelled")

    # Fulfilment eligibility: a cancelled or already-handed-over order
    # must not pass verification even if its token was never consumed.
    if order.status in ("CANCELLED", "DELIVERED"):
        raise HTTPException(
            status_code=409,
            detail=f"Order is {order.status} and cannot be handed over.",
        )

    if order.status == "NEEDS_RESOLUTION":
        raise HTTPException(
            status_code=409,
            detail="Order needs manager resolution before handover.",
        )

    # ATOMIC single-use claim. Two couriers scanning the same QR at the
    # same instant would both pass a read-then-write check; this guarded
    # UPDATE lets exactly one win.
    claimed = db.execute(text("""
        UPDATE order_verifications
           SET status = 'USED', used_at = :now, used_by_account_id = :account_id
         WHERE id = :vid
           AND status = 'ACTIVE'
    """), {
        "vid": verification.id,
        "now": datetime.utcnow(),
        "account_id": account.account_id,
    })

    if claimed.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="This order has already been verified/handed over")

    db.commit()

    log.info("verification.ok order_id=%s canteen=%s by=%s", order.id, canteen.id, account.account_id)

    return {
        "message": "Order verified -- handover allowed",
        "order_id": order.id,
        "canteen_name": canteen.name,
        "status": order.status,
        "customer": _customer_label(db, order),
    }


# ============================================================
# SCAN (what the delivery scanner posts the raw QR payload to)
# ============================================================
# The client sends exactly what the camera decoded and does NOTHING
# else -- it never inspects the payload to decide validity. All
# authority (token existence, tenant scope, order state, replay) lives
# in verify_order_token above.

@router.post("/scan")
def scan_qr_payload(
    body: QRScanRequest,
    account: CurrentAccount = Depends(require_operational_account),
    db: Session = Depends(get_db),
):
    raw = (body.payload or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty QR payload")

    token = raw

    # Legacy compatibility: the mobile app's pickup QR predates opaque
    # tokens and encodes {"order_id": N}. That id is treated ONLY as a
    # lookup hint -- the backend still enforces tenant scope, order state
    # and single use below. New QRs carry the opaque token instead.
    legacy_order_id = None
    if raw.startswith("{"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and parsed.get("order_id") is not None:
                legacy_order_id = int(parsed["order_id"])
        except (ValueError, TypeError):
            legacy_order_id = None

    if legacy_order_id is not None:
        verification = db.query(OrderVerification).filter(
            OrderVerification.order_id == legacy_order_id
        ).first()
        if not verification:
            raise HTTPException(status_code=404, detail="Invalid QR")
        token = verification.token
        log.info("verification.scan.legacy_payload order_id=%s", legacy_order_id)

    return verify_order_token(token=token, account=account, db=db)


# ============================================================
# LOOKUP (fallback if the customer cannot present the QR)
# ============================================================
# Staff/Manager, own canteen only. Does not consume the token -- just
# re-surfaces it so staff can re-display/re-send it.

@router.get("/order/{order_id}")
def get_order_verification(
    order_id: int,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    order, canteen = _order_and_canteen_or_404(db, order_id)
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    verification = db.query(OrderVerification).filter(OrderVerification.order_id == order_id).first()
    if not verification:
        raise HTTPException(status_code=404, detail="No verification token for this order")

    return {
        "order_id": order.id,
        "token": verification.token,
        "status": verification.status.value,
        "created_at": verification.created_at.isoformat(),
        "used_at": verification.used_at.isoformat() if verification.used_at else None,
    }

"""
Payment endpoints.

The confirmation endpoint is the development/manual settlement path that
exists only until a real gateway is integrated. It is deliberately NOT a
"payment successful" button a customer can call: it requires an
authenticated operational staff token, validates the tenant boundary,
records who confirmed it, and is idempotent.

When a real gateway arrives it posts to a webhook instead; both paths
call the same payment_service transitions.
"""

import hashlib
import hmac
import json
import logging
import os

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from auth import require_operational_account, require_manager, assert_canteen_in_scope, CurrentAccount
from database import get_db
from errors import TransactionError, ErrorCode, not_found
from models import Canteen, Order, Payment, PaymentStatus
from modules.payments import service as payment_service
from modules.payments import reconciliation
from modules.transactions import idempotency as idem

log = logging.getLogger("transactions.payments.router")

router = APIRouter(prefix="/payments", tags=["Payments"])


def _load_scoped_payment(db: Session, order_id: int, account: CurrentAccount):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise not_found("Order not found.")

    canteen = db.query(Canteen).filter(Canteen.id == order.canteen_id).first()
    if not canteen:
        raise not_found("Canteen not found.")

    # Tenant boundary from the verified token -- a manager cannot confirm
    # another college's payment by passing its order id.
    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    payment = (
        db.query(Payment)
        .filter(Payment.order_id == order_id)
        .order_by(Payment.id.desc())
        .first()
    )
    if not payment:
        raise not_found("No payment record for this order.")

    return order, payment


@router.get("/order/{order_id}")
def get_payment_for_order(
    order_id: int,
    account: CurrentAccount = Depends(require_operational_account),
    db: Session = Depends(get_db),
):
    order, payment = _load_scoped_payment(db, order_id, account)
    return {
        "order_id": order.id,
        "order_status": order.status,
        "payment_id": payment.id,
        "payment_status": payment.status,
        "amount": float(payment.amount or 0),
        "method": payment.method,
        "provider": payment.provider,
        "confirmed_at": payment.confirmed_at.isoformat() if payment.confirmed_at else None,
        "confirmed_by_account_id": payment.confirmed_by_account_id,
        "confirmation_method": payment.confirmation_method,
    }


@router.post("/order/{order_id}/confirm")
def confirm_payment_received(
    order_id: int,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    account: CurrentAccount = Depends(require_operational_account),
    db: Session = Depends(get_db),
):
    """
    Staff confirms the money actually arrived (cash in the drawer, or the
    UPI transfer visible in their app) and the order's inventory is
    committed.

    Idempotent: confirming twice settles once and commits inventory once.
    """
    order, payment = _load_scoped_payment(db, order_id, account)

    if payment.status == PaymentStatus.SUCCESS.value:
        return {
            "order_id": order.id,
            "payment_id": payment.id,
            "payment_status": payment.status,
            "changed": False,
            "message": "Payment was already confirmed.",
        }

    if payment.status in (PaymentStatus.FAILED.value, PaymentStatus.REFUNDED.value):
        raise TransactionError(
            ErrorCode.PAYMENT_ALREADY_SETTLED,
            f"Payment is already {payment.status} and cannot be confirmed.",
            status_code=409,
        )

    key = idempotency_key or f"confirm-{order_id}"
    fingerprint = idem.hash_request({"order_id": order_id, "action": "confirm"})
    record, replayed = idem.begin(db, key, "payment_confirm", fingerprint)
    if replayed is not None:
        return replayed

    try:
        outcome = payment_service.mark_payment_success(
            db, payment,
            account_id=account.account_id,
            confirmation_method="DEVELOPMENT_MANUAL",
        )

        response = {
            "order_id": order.id,
            "payment_id": payment.id,
            "payment_status": outcome["payment_status"],
            "order_status": outcome.get("order_status"),
            "outcome": outcome.get("outcome"),
            "changed": outcome["changed"],
            "confirmed_by_account_id": account.account_id,
        }

        idem.complete(db, record, response)
        db.commit()
        return response

    except TransactionError:
        db.rollback()
        idem.discard(db, key)
        db.commit()
        raise
    except Exception:
        db.rollback()
        idem.discard(db, key)
        db.commit()
        log.exception("payment.confirm.failed order_id=%s", order_id)
        raise TransactionError(
            ErrorCode.INVALID_ORDER, "Could not confirm the payment.", status_code=500
        )


@router.post("/order/{order_id}/fail")
def mark_payment_failed(
    order_id: int,
    reason: str = "STAFF_MARKED_FAILED",
    account: CurrentAccount = Depends(require_operational_account),
    db: Session = Depends(get_db),
):
    """Payment did not arrive: fail it and return the held stock."""
    order, payment = _load_scoped_payment(db, order_id, account)

    try:
        outcome = payment_service.mark_payment_failed(db, payment, reason=reason)
        db.commit()
    except TransactionError:
        db.rollback()
        raise

    return {
        "order_id": order.id,
        "payment_id": payment.id,
        "payment_status": outcome["payment_status"],
        "released_reservations": outcome.get("released", 0),
        "changed": outcome["changed"],
    }


# ============================================================
# GATEWAY WEBHOOK  (§10)
# ============================================================
# Wired now so a real provider can be dropped in without touching
# checkout, inventory, orders, reports or delivery. It is intentionally
# INERT until a gateway is configured: with no shared secret there is no
# way to authenticate a caller, and an unauthenticated endpoint that can
# mark payments SUCCESS would be the worst hole in the system.
#
# The duplicate/replay guarantee is a UNIQUE(provider, provider_event_id)
# constraint, so the same event delivered twice -- concurrently, late, or
# after a restart -- applies exactly once.

@router.post("/webhook/{provider_name}")
async def payment_webhook(
    provider_name: str,
    request: Request,
    db: Session = Depends(get_db),
):
    secret = os.getenv("PAYMENT_WEBHOOK_SECRET")
    if not secret:
        raise TransactionError(
            ErrorCode.INVALID_ORDER,
            "No payment gateway is configured; webhooks are disabled.",
            status_code=503,
        )

    raw_body = await request.body()
    signature = request.headers.get("X-Signature", "")

    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        log.warning("payment.webhook.bad_signature provider=%s", provider_name)
        raise TransactionError(
            ErrorCode.UNAUTHORIZED_TENANT, "Invalid webhook signature.", status_code=401
        )

    try:
        event = json.loads(raw_body or b"{}")
    except ValueError:
        raise TransactionError(ErrorCode.INVALID_ORDER, "Malformed webhook body.", 400)

    event_id = event.get("event_id")
    provider_payment_id = event.get("payment_id")
    event_type = (event.get("type") or "").upper()

    if not event_id or not provider_payment_id:
        raise TransactionError(
            ErrorCode.INVALID_ORDER, "Webhook missing event_id or payment_id.", 400
        )

    payment = (
        db.query(Payment)
        .filter(
            Payment.provider == provider_name,
            Payment.provider_payment_id == str(provider_payment_id),
        )
        .first()
    )
    if not payment:
        # 200 so the provider stops retrying an event we can never match.
        log.warning("payment.webhook.unknown_payment provider=%s ref=%s",
                    provider_name, provider_payment_id)
        return {"received": True, "matched": False}

    # Replay guard. A second delivery of this event id records nothing
    # and, critically, re-applies no state change.
    is_new = payment_service.record_provider_event(
        db, provider_name, str(event_id), event_type, payment.id
    )
    if not is_new:
        db.commit()
        return {"received": True, "duplicate": True, "payment_status": payment.status}

    if event_type in ("PAYMENT_SUCCEEDED", "PAYMENT_CAPTURED", "SUCCESS"):
        outcome = payment_service.mark_payment_success(
            db, payment, confirmation_method="GATEWAY_WEBHOOK")
    elif event_type in ("PAYMENT_FAILED", "FAILED"):
        outcome = payment_service.mark_payment_failed(db, payment, reason="GATEWAY_WEBHOOK")
    else:
        outcome = {"changed": False, "payment_status": payment.status}

    db.commit()
    log.info("payment.webhook provider=%s event=%s type=%s payment_id=%s changed=%s",
             provider_name, event_id, event_type, payment.id, outcome.get("changed"))

    return {"received": True, "duplicate": False, **outcome}


# ============================================================
# RECONCILIATION  (§12)  -- Manager only
# ============================================================

@router.post("/reconcile")
def run_reconciliation(
    older_than_minutes: int = 15,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Surface payments stuck in PENDING and align them with provider truth.

    With no gateway integrated this reports what needs attention and
    changes nothing -- a PENDING payment is never assumed to have failed.
    """
    report = reconciliation.reconcile_pending_payments(db, older_than_minutes)
    log.info("reconcile.run by=%s examined=%s settled=%s failed=%s unresolved=%s",
             account.account_id, report["examined"], report["settled"],
             report["failed"], report["unresolved"])
    return report

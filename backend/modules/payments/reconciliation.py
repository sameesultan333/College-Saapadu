"""
Payment reconciliation.

The provider is the source of truth for whether money moved. Our local
row can disagree with it for entirely normal reasons:

    payment succeeded -> our server crashed before writing it
    payment succeeded -> the webhook is delayed or was dropped
    the customer closed the app mid-flow

So a payment sitting at PENDING does NOT mean it failed. This module
finds those stuck rows and asks the provider what actually happened.

Until a real gateway exists there is nothing authoritative to ask, so
`reconcile_pending_payments` reports what it WOULD reconcile and changes
nothing. That is deliberate: inventing a SUCCESS or FAILED result when
provider truth is unavailable is exactly the failure mode §12 forbids.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models import Payment, PaymentStatus
from modules.payments import providers, service as payment_service

log = logging.getLogger("transactions.reconciliation")


def find_stuck_payments(db: Session, older_than_minutes: int = 15, limit: int = 200):
    """Payments left PENDING long enough to be suspicious."""
    cutoff = datetime.utcnow() - timedelta(minutes=older_than_minutes)
    return (
        db.query(Payment)
        .filter(
            Payment.status == PaymentStatus.PENDING.value,
            Payment.created_at <= cutoff,
        )
        .order_by(Payment.created_at)
        .limit(limit)
        .all()
    )


def reconcile_payment(db: Session, payment: Payment) -> dict:
    """
    Ask the provider for this payment's real status and align local state.

    Only a definitive provider answer changes anything:
      provider SUCCESS -> settle locally (commits inventory, idempotent)
      provider FAILED  -> fail locally (releases inventory, idempotent)
      unknown          -> leave it alone and surface it for a human
    """
    provider = providers.get_provider(payment.method or "")

    fetch = getattr(provider, "fetch_status", None)
    if fetch is None:
        # Development/manual provider: no external authority exists yet.
        return {
            "payment_id": payment.id,
            "order_id": payment.order_id,
            "local_status": payment.status,
            "provider_status": "UNAVAILABLE",
            "action": "NONE",
            "reason": "No payment gateway integrated; manual confirmation required.",
        }

    provider_status = fetch(payment.provider_payment_id)

    if provider_status == PaymentStatus.SUCCESS.value:
        payment_service.mark_payment_success(
            db, payment, confirmation_method="RECONCILIATION")
        db.commit()
        action = "SETTLED"
    elif provider_status == PaymentStatus.FAILED.value:
        payment_service.mark_payment_failed(db, payment, reason="RECONCILED_FAILED")
        db.commit()
        action = "FAILED"
    else:
        # Never invent an outcome from an unknown provider answer.
        action = "NONE"

    log.info("reconcile payment_id=%s local=%s provider=%s action=%s",
             payment.id, payment.status, provider_status, action)

    return {
        "payment_id": payment.id,
        "order_id": payment.order_id,
        "local_status": payment.status,
        "provider_status": provider_status,
        "action": action,
    }


def reconcile_pending_payments(db: Session, older_than_minutes: int = 15) -> dict:
    stuck = find_stuck_payments(db, older_than_minutes=older_than_minutes)
    results = [reconcile_payment(db, p) for p in stuck]
    return {
        "examined": len(stuck),
        "settled": sum(1 for r in results if r["action"] == "SETTLED"),
        "failed": sum(1 for r in results if r["action"] == "FAILED"),
        "unresolved": sum(1 for r in results if r["action"] == "NONE"),
        "results": results,
    }

"""
Durable checkout idempotency.

A lost response followed by a client retry must return the ORIGINAL
result, not create a second order. The guarantee comes from the UNIQUE
constraint on idempotency_keys.key: two concurrent retries both try to
INSERT, PostgreSQL lets exactly one through, and the loser reads the
winner's stored response. Disabling a button in the UI is not a
substitute for this.
"""

import hashlib
import json
import logging

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from errors import TransactionError, ErrorCode, duplicate_request
from models import IdempotencyKey

log = logging.getLogger("transactions.idempotency")

STATUS_IN_PROGRESS = "IN_PROGRESS"
STATUS_COMPLETED = "COMPLETED"


def hash_request(payload) -> str:
    body = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def begin(db: Session, key: str, scope: str, request_hash: str):
    """
    Claim an idempotency key.

    Returns (record, replayed_response):
      (record, None)      -> caller owns this operation, proceed
      (record, response)   -> already completed, return the stored result
    Raises DUPLICATE_REQUEST if an identical key is still in flight, and
    IDEMPOTENCY_KEY_REUSED if the same key arrives with a different body.
    """
    record = IdempotencyKey(
        key=key,
        scope=scope,
        request_hash=request_hash,
        status=STATUS_IN_PROGRESS,
    )
    db.add(record)
    try:
        # SAVEPOINT: a duplicate-key violation must not poison the outer
        # transaction the caller is running in.
        with db.begin_nested():
            db.flush()
        return record, None
    except IntegrityError:
        db.rollback()

    existing = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
    if existing is None:
        # Lost the race then the winner vanished; let the caller retry.
        raise duplicate_request()

    if existing.request_hash and existing.request_hash != request_hash:
        raise TransactionError(
            ErrorCode.IDEMPOTENCY_KEY_REUSED,
            "This idempotency key was already used for a different request.",
            status_code=409,
        )

    if existing.status == STATUS_COMPLETED and existing.response_body:
        log.info("idempotency.replay key=%s scope=%s", key, scope)
        return existing, json.loads(existing.response_body)

    # Still in flight elsewhere -- the client should retry, not duplicate.
    raise duplicate_request("An identical request is still being processed.")


def complete(db: Session, record: IdempotencyKey, response: dict) -> None:
    from datetime import datetime

    record.status = STATUS_COMPLETED
    record.response_body = json.dumps(response, default=str)
    record.completed_at = datetime.utcnow()
    db.add(record)


def discard(db: Session, key: str) -> None:
    """
    Drop a failed attempt's key so the customer can genuinely retry.
    Called only when the operation failed and nothing was persisted.
    """
    db.query(IdempotencyKey).filter(
        IdempotencyKey.key == key,
        IdempotencyKey.status == STATUS_IN_PROGRESS,
    ).delete(synchronize_session=False)

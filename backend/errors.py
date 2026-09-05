"""
Deterministic, client-safe error codes for the transaction core.

Clients branch on `code`, never on prose. Internal exception text and
database errors are never forwarded to the client -- the router logs the
detail and raises one of these instead.
"""

from fastapi import HTTPException


class ErrorCode:
    INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK"
    INVALID_ORDER = "INVALID_ORDER"
    UNAUTHORIZED_TENANT = "UNAUTHORIZED_TENANT"
    DUPLICATE_REQUEST = "DUPLICATE_REQUEST"
    IDEMPOTENCY_KEY_REUSED = "IDEMPOTENCY_KEY_REUSED"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    PAYMENT_ALREADY_SETTLED = "PAYMENT_ALREADY_SETTLED"
    RESERVATION_EXPIRED = "RESERVATION_EXPIRED"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    NEEDS_RESOLUTION = "NEEDS_RESOLUTION"
    NOT_FOUND = "NOT_FOUND"


class TransactionError(HTTPException):
    """An expected, client-facing failure with a stable machine code."""

    def __init__(self, code: str, message: str, status_code: int = 400, **context):
        self.code = code
        self.context = context
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message, **context},
        )


def insufficient_stock(item_name: str, requested: int, available: int) -> TransactionError:
    return TransactionError(
        ErrorCode.INSUFFICIENT_STOCK,
        f"{item_name} does not have enough stock.",
        status_code=409,
        item=item_name,
        requested=requested,
        available=available,
    )


def unauthorized_tenant(message: str = "Resource belongs to a different tenant.") -> TransactionError:
    return TransactionError(ErrorCode.UNAUTHORIZED_TENANT, message, status_code=403)


def invalid_order(message: str) -> TransactionError:
    return TransactionError(ErrorCode.INVALID_ORDER, message, status_code=400)


def not_found(message: str) -> TransactionError:
    return TransactionError(ErrorCode.NOT_FOUND, message, status_code=404)


def invalid_transition(entity: str, current: str, target: str) -> TransactionError:
    return TransactionError(
        ErrorCode.INVALID_STATE_TRANSITION,
        f"{entity} cannot move from {current} to {target}.",
        status_code=409,
        entity=entity,
        current_state=current,
        target_state=target,
    )


def duplicate_request(message: str = "This request is already being processed.") -> TransactionError:
    return TransactionError(ErrorCode.DUPLICATE_REQUEST, message, status_code=409)

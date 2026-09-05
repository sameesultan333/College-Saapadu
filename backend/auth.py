import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from models import RefreshToken

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set. Add it to backend/.env "
        "(see backend/.env.example)."
    )

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

bearer_scheme = HTTPBearer()


# ============================================================
# ACCESS TOKEN (JWT, short-lived, stateless)
# ============================================================

def create_access_token(
    account_type: str,
    account_id: int,
    role: str,
    college_id: int | None,
    canteen_id: int | None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": f"{account_type}:{account_id}",
        "account_type": account_type,
        "account_id": account_id,
        "role": role,
        "college_id": college_id,
        "canteen_id": canteen_id,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Access token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid access token")


# ============================================================
# REFRESH TOKEN (opaque random string, hashed at rest, rotated)
# ============================================================

def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def issue_refresh_token(db: Session, account_type: str, account_id: int) -> str:
    raw_token = secrets.token_urlsafe(48)

    db.add(RefreshToken(
        token_hash=_hash_token(raw_token),
        account_type=account_type,
        account_id=account_id,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    return raw_token


def rotate_refresh_token(db: Session, raw_token: str) -> RefreshToken:
    """Validate an incoming refresh token and revoke it (caller issues a new one)."""
    row = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash_token(raw_token)
    ).first()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if row.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Refresh token already used/revoked")

    if row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Refresh token expired")

    row.revoked_at = datetime.utcnow()
    db.commit()

    return row


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    row = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash_token(raw_token)
    ).first()

    if row and row.revoked_at is None:
        row.revoked_at = datetime.utcnow()
        db.commit()


def issue_token_pair(db: Session, account_type: str, account_id: int, role: str,
                      college_id: int | None, canteen_id: int | None) -> dict:
    return {
        "access_token": create_access_token(
            account_type, account_id, role, college_id, canteen_id
        ),
        "refresh_token": issue_refresh_token(db, account_type, account_id),
        "token_type": "bearer",
        "role": role,
        "college_id": college_id,
        "canteen_id": canteen_id,
    }


# ============================================================
# REQUEST-SCOPED IDENTITY DEPENDENCIES
# ============================================================
# Every protected endpoint depends on one of these. The scope
# (college_id/canteen_id/role) always comes from the verified
# JWT payload, never from anything the client sends in the body
# or query string.

class CurrentAccount:
    def __init__(self, account_type: str, account_id: int, role: str,
                 college_id: int | None, canteen_id: int | None):
        self.account_type = account_type
        self.account_id = account_id
        self.role = role
        self.college_id = college_id
        self.canteen_id = canteen_id


def get_current_account(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentAccount:
    payload = decode_access_token(credentials.credentials)
    return CurrentAccount(
        account_type=payload["account_type"],
        account_id=payload["account_id"],
        role=payload["role"],
        college_id=payload.get("college_id"),
        canteen_id=payload.get("canteen_id"),
    )


def require_company_admin(
    account: CurrentAccount = Depends(get_current_account),
) -> CurrentAccount:
    if account.account_type != "company_admin":
        raise HTTPException(status_code=403, detail="Company admin access required")
    return account


def require_manager(
    account: CurrentAccount = Depends(get_current_account),
) -> CurrentAccount:
    if account.account_type != "staff" or account.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return account


def require_staff_or_manager(
    account: CurrentAccount = Depends(get_current_account),
) -> CurrentAccount:
    if account.account_type != "staff" or account.role not in ("manager", "staff"):
        raise HTTPException(status_code=403, detail="Staff access required")
    return account


def require_customer(
    account: CurrentAccount = Depends(get_current_account),
) -> CurrentAccount:
    """A logged-in mobile-app customer (models.User), scoped to their own
    college. Never confused with StaffAccount -- customers have no
    canteen_id and no operational role."""
    if account.account_type != "customer":
        raise HTTPException(status_code=403, detail="Customer login required")
    return account


def require_operational_account(
    account: CurrentAccount = Depends(get_current_account),
) -> CurrentAccount:
    """Manager, canteen Staff, or Delivery -- the three canteen-scoped roles that
    share the order queue/status endpoints used by both admin-dashboard and
    delivery-dashboard."""
    if account.account_type != "staff" or account.role not in ("manager", "staff", "delivery"):
        raise HTTPException(status_code=403, detail="Operational staff access required")
    return account


def assert_canteen_in_scope(account: CurrentAccount, canteen_college_id: int, canteen_id: int) -> None:
    """Manager: any canteen in their own college. Staff/Delivery: only their assigned canteen."""
    if account.college_id != canteen_college_id:
        raise HTTPException(status_code=403, detail="Canteen belongs to a different college")

    if account.role in ("staff", "delivery") and account.canteen_id != canteen_id:
        raise HTTPException(status_code=403, detail="Not authorized for this canteen")

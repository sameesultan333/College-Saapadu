from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, Order, OrderItem, College, RefreshToken
from schemas import UserCreate, LoginRequest, RefreshRequest, LogoutRequest
from security import hash_password, verify_password
from auth import (
    issue_token_pair,
    rotate_refresh_token,
    revoke_refresh_token,
    require_customer,
    require_company_admin,
    CurrentAccount,
)


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


def get_active_college_or_404(college_id: int, db: Session) -> College:
    college = db.query(College).filter(
        College.id == college_id,
        College.is_active == True
    ).first()

    if not college:
        raise HTTPException(
            status_code=404,
            detail="Invalid or inactive college"
        )

    return college


# Registration eligibility check.
# Currently open registration: any institutional_id is allowed.
# Future: check the institutional_id against the college's imported master data.
def check_registration_eligibility(
    college_id: int,
    institutional_id: str,
    db: Session
) -> bool:
    return True


# Create user (registration)
@router.post("/create")
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    get_active_college_or_404(user.college_id, db)

    if not check_registration_eligibility(user.college_id, user.institutional_id, db):
        raise HTTPException(
            status_code=403,
            detail="Not eligible to register for this college"
        )

    existing_id = db.query(User).filter(
        User.college_id == user.college_id,
        User.institutional_id == user.institutional_id
    ).first()

    if existing_id:
        raise HTTPException(
            status_code=400,
            detail="Institutional ID already registered for this college"
        )

    existing_phone = db.query(User).filter(
        User.college_id == user.college_id,
        User.phone == user.phone
    ).first()

    if existing_phone:
        raise HTTPException(
            status_code=400,
            detail="Phone number already registered for this college"
        )

    new_user = User(
        college_id=user.college_id,
        institutional_id=user.institutional_id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        password=hash_password(user.password),
        wallet_balance=0.0,
        role=user.role,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User created successfully"
    }


# List users -- Company Admin only. Was previously unauthenticated and
# returned raw ORM rows, which leaked every user's bcrypt password hash
# to any unauthenticated caller. Locked down and hashes stripped rather
# than left as an open data leak with no legitimate frontend caller.
@router.get("")
def list_users(
    _admin: CurrentAccount = Depends(require_company_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "college_id": u.college_id,
            "institutional_id": u.institutional_id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "role": u.role,
            "wallet_balance": u.wallet_balance,
        }
        for u in users
    ]


# Delete a user -- Company Admin only (was previously unauthenticated).
@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    _admin: CurrentAccount = Depends(require_company_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Get all orders for this user
    user_orders = db.query(Order).filter(
        Order.user_id == user_id
    ).all()

    order_ids = [order.id for order in user_orders]

    # Delete order items for these orders
    if order_ids:
        db.query(OrderItem).filter(
            OrderItem.order_id.in_(order_ids)
        ).delete(
            synchronize_session=False
        )

    # Delete orders
    db.query(Order).filter(
        Order.user_id == user_id
    ).delete()

    # Drop any outstanding refresh tokens so a deleted account can't
    # still mint fresh access tokens via /users/refresh.
    db.query(RefreshToken).filter(
        RefreshToken.account_type == "customer",
        RefreshToken.account_id == user_id,
    ).delete()

    # Delete the user
    db.delete(user)
    db.commit()

    return {
        "message": f"User {user_id} and all related data deleted successfully"
    }


# User login -- issues a JWT access/refresh pair, same scheme as
# staff/company_admin (see auth.py). Every previously anonymous
# customer-facing endpoint (order placement, wallet, order tracking,
# order history) now derives the customer's identity from this token
# rather than trusting a client-supplied user_id.
@router.post("/login")
def login_user(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    # No college_id from the client -- phone is globally unique, so it
    # alone resolves the account (see models.py User.phone). College is
    # derived from the account, never trusted from the request.
    user = db.query(User).filter(
        User.phone == data.phone
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Invalid phone number"
        )

    if not verify_password(data.password, user.password):
        raise HTTPException(
            status_code=401,
            detail="Invalid password"
        )

    # The account's college could have since been deactivated -- don't let
    # a correct password bypass that.
    college = db.query(College).filter(
        College.id == user.college_id,
        College.is_active == True
    ).first()
    if not college:
        raise HTTPException(
            status_code=403,
            detail="Your college is currently inactive. Contact your administrator."
        )

    tokens = issue_token_pair(
        db,
        account_type="customer",
        account_id=user.id,
        role=user.role or "student",
        college_id=user.college_id,
        canteen_id=None,
    )

    return {
        "id": user.id,
        "college_id": user.college_id,
        "institutional_id": user.institutional_id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "wallet_balance": user.wallet_balance,
        **tokens,
    }


# ============================================================
# REFRESH / LOGOUT
# ============================================================
# Same rotate-on-use scheme as staff/company_admin -- see auth.py.

@router.post("/refresh")
def refresh_user_token(
    data: RefreshRequest,
    db: Session = Depends(get_db)
):
    row = rotate_refresh_token(db, data.refresh_token)

    if row.account_type != "customer":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == row.account_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Account no longer active")

    return issue_token_pair(
        db,
        account_type="customer",
        account_id=user.id,
        role=user.role or "student",
        college_id=user.college_id,
        canteen_id=None,
    )


@router.post("/logout")
def logout_user(
    data: LogoutRequest,
    db: Session = Depends(get_db)
):
    revoke_refresh_token(db, data.refresh_token)
    return {"message": "Logged out"}


@router.get("/me")
def get_my_profile(
    account: CurrentAccount = Depends(require_customer),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == account.account_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    return {
        "id": user.id,
        "college_id": user.college_id,
        "institutional_id": user.institutional_id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "wallet_balance": user.wallet_balance,
    }

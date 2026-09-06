from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import StaffAccount, StaffRole, Canteen, RefreshToken
from schemas import (
    StaffLogin,
    StaffCreate,
    TokenResponse,
    RefreshRequest,
    LogoutRequest,
)
from security import hash_password, verify_password
from auth import (
    issue_token_pair,
    rotate_refresh_token,
    revoke_refresh_token,
    require_manager,
    get_current_account,
    CurrentAccount,
)


router = APIRouter(
    prefix="/staff",
    tags=["Staff"]
)


# ============================================================
# LOGIN  (college + phone + password -> manager or staff)
# ============================================================

@router.post("/login", response_model=TokenResponse)
def login_staff(
    data: StaffLogin,
    db: Session = Depends(get_db)
):
    # No college_id from the client -- phone is globally unique, so it
    # alone resolves the account (see models.py StaffAccount.phone).
    account = db.query(StaffAccount).filter(
        StaffAccount.phone == data.phone
    ).first()

    if not account or not verify_password(data.password, account.password):
        raise HTTPException(status_code=401, detail="Invalid phone or password")

    if not account.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    tokens = issue_token_pair(
        db,
        account_type="staff",
        account_id=account.id,
        role=account.role.value,
        college_id=account.college_id,
        canteen_id=account.canteen_id,
    )
    tokens["name"] = account.name

    return tokens


# ============================================================
# REFRESH / LOGOUT
# ============================================================

@router.post("/refresh", response_model=TokenResponse)
def refresh_staff_token(
    data: RefreshRequest,
    db: Session = Depends(get_db)
):
    row = rotate_refresh_token(db, data.refresh_token)

    if row.account_type != "staff":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    account = db.query(StaffAccount).filter(StaffAccount.id == row.account_id).first()

    if not account or not account.is_active:
        raise HTTPException(status_code=401, detail="Account no longer active")

    tokens = issue_token_pair(
        db,
        account_type="staff",
        account_id=account.id,
        role=account.role.value,
        college_id=account.college_id,
        canteen_id=account.canteen_id,
    )
    tokens["name"] = account.name

    return tokens


@router.post("/logout")
def logout_staff(
    data: LogoutRequest,
    db: Session = Depends(get_db)
):
    revoke_refresh_token(db, data.refresh_token)
    return {"message": "Logged out"}


# ============================================================
# CURRENT PROFILE
# ============================================================

@router.get("/me")
def get_my_profile(
    account: CurrentAccount = Depends(get_current_account),
    db: Session = Depends(get_db)
):
    if account.account_type != "staff":
        raise HTTPException(status_code=403, detail="Staff access required")

    staff = db.query(StaffAccount).filter(StaffAccount.id == account.account_id).first()

    if not staff:
        raise HTTPException(status_code=404, detail="Account not found")

    canteen_name = None
    if staff.canteen_id:
        canteen = db.query(Canteen).filter(Canteen.id == staff.canteen_id).first()
        canteen_name = canteen.name if canteen else None

    return {
        "id": staff.id,
        "name": staff.name,
        "staff_id": staff.staff_id,
        "phone": staff.phone,
        "role": staff.role.value,
        "college_id": staff.college_id,
        "canteen_id": staff.canteen_id,
        "canteen_name": canteen_name,
    }


# ============================================================
# MANAGER: CREATE / LIST / TOGGLE STAFF
# ============================================================
# canteen_id is client-supplied (the manager picks which of THEIR
# college's canteens the new staff belongs to) but must be
# validated against the manager's own college_id before use.
# college_id/role are never taken from the client.

@router.post("/create")
def create_staff(
    data: StaffCreate,
    manager: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    canteen = db.query(Canteen).filter(Canteen.id == data.canteen_id).first()

    if not canteen or canteen.college_id != manager.college_id:
        raise HTTPException(status_code=404, detail="Canteen not found in your college")

    existing = db.query(StaffAccount).filter(
        StaffAccount.college_id == manager.college_id,
        StaffAccount.phone == data.phone
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="A staff account with this phone already exists")

    staff = StaffAccount(
        college_id=manager.college_id,
        canteen_id=canteen.id,
        name=data.name,
        staff_id=data.staff_id,
        phone=data.phone,
        password=hash_password(data.password),
        role=StaffRole.DELIVERY if data.role == "delivery" else StaffRole.STAFF,
    )

    db.add(staff)
    db.commit()
    db.refresh(staff)

    return {
        "message": "Staff created",
        "id": staff.id,
        "name": staff.name,
        "staff_id": staff.staff_id,
        "canteen_id": staff.canteen_id,
        "role": staff.role.value,
    }


@router.get("")
def list_staff(
    canteen_id: int | None = None,
    role: str = "staff",
    manager: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    if role not in ("staff", "delivery"):
        raise HTTPException(status_code=400, detail="role must be 'staff' or 'delivery'")

    query = db.query(StaffAccount).filter(
        StaffAccount.college_id == manager.college_id,
        StaffAccount.role == (StaffRole.DELIVERY if role == "delivery" else StaffRole.STAFF),
    )

    if canteen_id is not None:
        query = query.filter(StaffAccount.canteen_id == canteen_id)

    staff_list = query.order_by(StaffAccount.id).all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "staff_id": s.staff_id,
            "phone": s.phone,
            "canteen_id": s.canteen_id,
            "is_active": s.is_active,
            "role": s.role.value,
        }
        for s in staff_list
    ]


@router.patch("/{staff_id}/toggle")
def toggle_staff(
    staff_id: int,
    manager: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    staff = db.query(StaffAccount).filter(
        StaffAccount.id == staff_id,
        StaffAccount.college_id == manager.college_id,
        StaffAccount.role.in_([StaffRole.STAFF, StaffRole.DELIVERY]),
    ).first()

    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found in your college")

    staff.is_active = not staff.is_active
    db.commit()

    return {
        "id": staff.id,
        "is_active": staff.is_active,
    }


@router.delete("/{staff_id}")
def delete_staff(
    staff_id: int,
    manager: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    staff = db.query(StaffAccount).filter(
        StaffAccount.id == staff_id,
        StaffAccount.college_id == manager.college_id,
        StaffAccount.role.in_([StaffRole.STAFF, StaffRole.DELIVERY]),
    ).first()

    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found in your college")

    db.query(RefreshToken).filter(
        RefreshToken.account_type == "staff",
        RefreshToken.account_id == staff.id,
    ).delete()

    db.delete(staff)
    db.commit()

    return {
        "message": "Staff account permanently deleted",
        "id": staff_id,
    }

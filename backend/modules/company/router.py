from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import CompanyAdmin, StaffAccount, StaffRole, College, RefreshToken
from schemas import (
    CompanyAdminLogin,
    TokenResponse,
    RefreshRequest,
    LogoutRequest,
    ManagerCreate,
)
from security import hash_password, verify_password
from auth import (
    issue_token_pair,
    rotate_refresh_token,
    revoke_refresh_token,
    require_company_admin,
    CurrentAccount,
)


router = APIRouter(
    prefix="/company",
    tags=["Company"]
)


# Default company admin credentials for initial platform bootstrap.
# Change this account's password after first login.
DEFAULT_COMPANY_ADMIN_EMAIL = "admin@collegesaapadu.com"
DEFAULT_COMPANY_ADMIN_PASSWORD = "CollegeSaapadu#2026"


def bootstrap_default_admin():
    db = SessionLocal()
    try:
        existing = db.query(CompanyAdmin).first()
        if existing:
            return

        db.add(CompanyAdmin(
            email=DEFAULT_COMPANY_ADMIN_EMAIL,
            password=hash_password(DEFAULT_COMPANY_ADMIN_PASSWORD)
        ))
        db.commit()
    finally:
        db.close()


# Company Admin login (email or phone + password)
@router.post("/login", response_model=TokenResponse)
def login_company_admin(
    data: CompanyAdminLogin,
    db: Session = Depends(get_db)
):
    if not data.email and not data.phone:
        raise HTTPException(
            status_code=400,
            detail="Email or phone is required"
        )

    query = db.query(CompanyAdmin)

    if data.email:
        admin = query.filter(CompanyAdmin.email == data.email).first()
    else:
        admin = query.filter(CompanyAdmin.phone == data.phone).first()

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Invalid email or phone"
        )

    if not verify_password(data.password, admin.password):
        raise HTTPException(
            status_code=401,
            detail="Invalid password"
        )

    tokens = issue_token_pair(
        db,
        account_type="company_admin",
        account_id=admin.id,
        role="company_admin",
        college_id=None,
        canteen_id=None,
    )
    tokens["name"] = admin.email or admin.phone

    return tokens


@router.post("/refresh", response_model=TokenResponse)
def refresh_company_admin_token(
    data: RefreshRequest,
    db: Session = Depends(get_db)
):
    row = rotate_refresh_token(db, data.refresh_token)

    if row.account_type != "company_admin":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    admin = db.query(CompanyAdmin).filter(CompanyAdmin.id == row.account_id).first()

    if not admin:
        raise HTTPException(status_code=401, detail="Account no longer active")

    tokens = issue_token_pair(
        db,
        account_type="company_admin",
        account_id=admin.id,
        role="company_admin",
        college_id=None,
        canteen_id=None,
    )
    tokens["name"] = admin.email or admin.phone

    return tokens


@router.post("/logout")
def logout_company_admin(
    data: LogoutRequest,
    db: Session = Depends(get_db)
):
    revoke_refresh_token(db, data.refresh_token)
    return {"message": "Logged out"}


# ============================================================
# MANAGER CREATION (Company Admin only)
# ============================================================
# The Company Admin assigns a Manager to a specific college.
# canteen_id stays NULL -> college-wide manager scope.

@router.post("/managers/create")
def create_manager(
    data: ManagerCreate,
    _: CurrentAccount = Depends(require_company_admin),
    db: Session = Depends(get_db)
):
    college = db.query(College).filter(College.id == data.college_id).first()

    if not college:
        raise HTTPException(status_code=404, detail="College not found")

    existing = db.query(StaffAccount).filter(
        StaffAccount.college_id == data.college_id,
        StaffAccount.phone == data.phone
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="A manager/staff with this phone already exists in this college")

    manager = StaffAccount(
        college_id=data.college_id,
        canteen_id=None,
        name=data.name,
        phone=data.phone,
        password=hash_password(data.password),
        role=StaffRole.MANAGER,
    )

    db.add(manager)
    db.commit()
    db.refresh(manager)

    return {
        "message": "Manager created",
        "id": manager.id,
        "name": manager.name,
        "college_id": manager.college_id,
    }


@router.get("/managers")
def list_managers(
    college_id: int | None = None,
    _: CurrentAccount = Depends(require_company_admin),
    db: Session = Depends(get_db)
):
    query = db.query(StaffAccount).filter(StaffAccount.role == StaffRole.MANAGER)

    if college_id is not None:
        query = query.filter(StaffAccount.college_id == college_id)

    managers = query.order_by(StaffAccount.id).all()

    return [
        {
            "id": m.id,
            "name": m.name,
            "phone": m.phone,
            "college_id": m.college_id,
            "is_active": m.is_active,
        }
        for m in managers
    ]


@router.patch("/managers/{manager_id}/toggle")
def toggle_manager(
    manager_id: int,
    _: CurrentAccount = Depends(require_company_admin),
    db: Session = Depends(get_db)
):
    manager = db.query(StaffAccount).filter(
        StaffAccount.id == manager_id,
        StaffAccount.role == StaffRole.MANAGER,
    ).first()

    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    manager.is_active = not manager.is_active
    db.commit()

    return {
        "id": manager.id,
        "is_active": manager.is_active,
    }


@router.delete("/managers/{manager_id}")
def delete_manager(
    manager_id: int,
    _: CurrentAccount = Depends(require_company_admin),
    db: Session = Depends(get_db)
):
    manager = db.query(StaffAccount).filter(
        StaffAccount.id == manager_id,
        StaffAccount.role == StaffRole.MANAGER,
    ).first()

    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    db.query(RefreshToken).filter(
        RefreshToken.account_type == "staff",
        RefreshToken.account_id == manager.id,
    ).delete()

    db.delete(manager)
    db.commit()

    return {
        "message": "Manager permanently deleted",
        "id": manager_id,
    }

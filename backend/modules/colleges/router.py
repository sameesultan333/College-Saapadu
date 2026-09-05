from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import get_db
from models import College
from schemas import CollegeCreate
from auth import require_company_admin, CurrentAccount


router = APIRouter(
    prefix="/colleges",
    tags=["Colleges"]
)


# Create college (Company Portal, Company Admin only)
@router.post("/create")
def create_college(
    college: CollegeCreate,
    _: CurrentAccount = Depends(require_company_admin),
    db: Session = Depends(get_db)
):
    new_college = College(
        name=college.name,
        is_active=True
    )

    db.add(new_college)
    db.commit()
    db.refresh(new_college)

    return {
        "message": "College created",
        "college_id": new_college.id,
        "name": new_college.name,
        "is_active": new_college.is_active
    }


# Get active colleges (login/registration dropdowns across all clients).
# Explicitly uncacheable: a college created in the Company Portal must show
# up in every login dropdown on the next load, so no browser or proxy may
# serve a stale list back.
@router.get("")
def get_colleges(
    response: Response,
    db: Session = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"

    return db.query(College).filter(
        College.is_active == True
    ).order_by(College.name).all()


# Get all colleges, active and inactive (Company Portal management, Company Admin only)
@router.get("/admin")
def get_all_colleges(
    _: CurrentAccount = Depends(require_company_admin),
    db: Session = Depends(get_db)
):
    return db.query(College).order_by(College.id).all()


# Get a single college by id (public). For a client that already knows its
# own college_id (from an authenticated login response) and just needs to
# resolve its display name -- avoids fetching every college on the platform
# just to find the one the caller belongs to.
@router.get("/{college_id}")
def get_college(
    college_id: int,
    db: Session = Depends(get_db)
):
    college = db.query(College).filter(College.id == college_id).first()

    if not college:
        raise HTTPException(status_code=404, detail="College not found")

    return college


# Activate/deactivate a college (Company Portal management, Company Admin only)
@router.patch("/{college_id}/toggle")
def toggle_college(
    college_id: int,
    _: CurrentAccount = Depends(require_company_admin),
    db: Session = Depends(get_db)
):
    college = db.query(College).filter(
        College.id == college_id
    ).first()

    if not college:
        raise HTTPException(
            status_code=404,
            detail="College not found"
        )

    college.is_active = not college.is_active
    db.commit()
    db.refresh(college)

    return {
        "message": "College updated",
        "college_id": college.id,
        "is_active": college.is_active
    }

import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import GuestCustomer
from schemas import GuestCreate
from auth import require_staff_or_manager, CurrentAccount


router = APIRouter(
    prefix="/guests",
    tags=["Guests"]
)


CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_guest_code(db: Session) -> str:
    # "G-8F42K7" style -- generated, never the phone number. Collisions
    # are astronomically unlikely (36^6 keyspace) but retried defensively.
    for _ in range(5):
        code = "G-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if not db.query(GuestCustomer).filter(GuestCustomer.guest_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate a unique guest code, try again")


# Create a walk-in guest identity. Staff or Manager only -- a walk-in
# customer has no app account and cannot authenticate themselves, so this
# is entered by whoever is operating the counter. college_id comes from
# the operator's own token, never the client.
@router.post("/create")
def create_guest(
    data: GuestCreate,
    account: CurrentAccount = Depends(require_staff_or_manager),
    db: Session = Depends(get_db)
):
    guest = GuestCustomer(
        guest_code=_generate_guest_code(db),
        name=data.name,
        phone=data.phone,
        category=data.category,
        college_id=account.college_id,
    )

    db.add(guest)
    db.commit()
    db.refresh(guest)

    return {
        "id": guest.id,
        "guest_code": guest.guest_code,
        "name": guest.name,
        "phone": guest.phone,
        "category": guest.category.value,
        "college_id": guest.college_id,
    }

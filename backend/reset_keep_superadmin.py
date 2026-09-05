"""
One-off dev reset: wipes every table and recreates the schema fresh from
the current models.py, but preserves the single existing CompanyAdmin
(superadmin) row instead of losing it like reset_db.py does.

Run manually: python reset_keep_superadmin.py
Refuses to run if there isn't exactly one CompanyAdmin row, so it never
silently guesses which admin to keep.
"""

from database import Base, SessionLocal, engine
from models import CompanyAdmin
import models  # noqa: F401  (ensures every model is registered on Base)

if __name__ == "__main__":
    db = SessionLocal()
    admins = db.query(CompanyAdmin).all()

    if len(admins) != 1:
        print(f"Expected exactly 1 CompanyAdmin row, found {len(admins)}. Aborting -- "
              "resolve which admin(s) to keep manually before running this.")
        db.close()
        raise SystemExit(1)

    kept = admins[0]
    preserved = {
        "id": kept.id,
        "email": kept.email,
        "phone": kept.phone,
        "password": kept.password,
        "created_at": kept.created_at,
    }
    db.close()

    confirm = input(
        f"This will DROP ALL TABLES and recreate them empty, keeping only "
        f"CompanyAdmin id={preserved['id']} phone={preserved['phone']}. "
        f"Type 'yes' to continue: "
    )
    if confirm.strip().lower() != "yes":
        print("Aborted.")
        raise SystemExit(0)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    db.add(CompanyAdmin(**preserved))
    db.commit()
    db.close()

    print(f"Reset complete. CompanyAdmin id={preserved['id']} phone={preserved['phone']} preserved; "
          "every other table is empty.")

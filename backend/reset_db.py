"""
One-off dev database reset for the Phase 2 multi-tenant staff/manager
schema change (Canteen.college_id is now required; new staff_accounts
and refresh_tokens tables added).

Run manually: python reset_db.py
Not imported by app.py -- startup only runs create_all, never drop_all.
"""

from database import Base, engine
import models  # noqa: F401  (ensures all models are registered on Base)

if __name__ == "__main__":
    confirm = input(
        "This will DROP ALL TABLES in the dev database and recreate them empty. "
        "Type 'yes' to continue: "
    )
    if confirm.strip().lower() != "yes":
        print("Aborted.")
    else:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("Database reset complete.")

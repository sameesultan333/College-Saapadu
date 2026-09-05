"""
Non-destructive migration for the Walk-in Customer / Order Verification
feature: makes orders.user_id nullable (guest orders have no user_id),
adds the orders.guest_id column, and creates the new
guest_customers / order_verifications tables.

Does NOT drop or touch existing rows -- unlike reset_db.py, this is safe
to run against a database with real data already in it.

Run manually: python migrate_guest_walkin.py
"""

from sqlalchemy import text
from database import Base, engine
import models  # noqa: F401  (registers new tables on Base.metadata)

if __name__ == "__main__":
    # Create new tables first (guest_customers, order_verifications) -- safe,
    # create_all only creates tables that don't already exist. orders.guest_id
    # can then reference guest_customers(id).
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_id INTEGER REFERENCES guest_customers(id)"))

    print("Migration complete: orders.user_id is now nullable, orders.guest_id "
          "added, guest_customers/order_verifications tables created (if missing).")

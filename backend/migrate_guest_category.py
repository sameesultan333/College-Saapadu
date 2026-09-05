"""
Non-destructive migration: adds guest_customers.category (STUDENT / PARENT
/ STAFF), backfilling existing rows to 'STUDENT' so the column can be
NOT NULL from day one without breaking rows created before this feature
existed.

Does NOT drop or touch any other data -- safe to run against a database
with real orders/guests already in it.

Run manually: python migrate_guest_category.py
"""

from sqlalchemy import text
from database import engine

if __name__ == "__main__":
    with engine.begin() as conn:
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'guestcategory'
                ) THEN
                    CREATE TYPE guestcategory AS ENUM ('STUDENT', 'PARENT', 'STAFF');
                END IF;
            END$$;
        """))
        conn.execute(text("""
            ALTER TABLE guest_customers
            ADD COLUMN IF NOT EXISTS category guestcategory NOT NULL DEFAULT 'STUDENT'
        """))

    print("Migration complete: guest_customers.category added "
          "(existing rows backfilled to 'STUDENT').")

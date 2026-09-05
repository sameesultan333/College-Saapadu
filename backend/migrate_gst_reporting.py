"""
Non-destructive migration for the Sales & GST reporting feature.

Adds:
  menu_items.gst_rate           (default 5%)
  order_items financial snapshot columns

Existing rows are preserved. Existing order_items keep NULL snapshots --
the report layer falls back to live menu pricing for those and flags the
report as containing estimated values.

Run: python migrate_gst_reporting.py
"""

from sqlalchemy import text

from database import engine, Base
import models  # noqa: F401  (registers any new tables on Base)

STATEMENTS = [
    "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS gst_rate DOUBLE PRECISION NOT NULL DEFAULT 5.0",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price DOUBLE PRECISION",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gst_rate DOUBLE PRECISION",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gross_amount DOUBLE PRECISION",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS taxable_amount DOUBLE PRECISION",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cgst_amount DOUBLE PRECISION",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sgst_amount DOUBLE PRECISION",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_gst_amount DOUBLE PRECISION",
    # Report queries always filter on canteen + created_at.
    "CREATE INDEX IF NOT EXISTS ix_orders_canteen_created_at ON orders (canteen_id, created_at)",
]

if __name__ == "__main__":
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            conn.execute(text(stmt))
            print("OK:", stmt.split(" ADD COLUMN IF NOT EXISTS ")[-1].split(" ")[0]
                  if "ADD COLUMN" in stmt else stmt[:60])

    Base.metadata.create_all(bind=engine)
    print("\nMigration complete. Existing data preserved.")

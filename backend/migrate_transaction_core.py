"""
Non-destructive migration for the transaction-core hardening.

  * money columns  double precision -> NUMERIC(12,2)   (exact arithmetic)
  * inventory buckets on menu_items  (reserved / committed)
  * CHECK constraints so the DATABASE refuses negative inventory
  * orders.payment_status, orders.total_amount
  * reservations / payments / payment_events / idempotency_keys
  * indexes for the real query paths

Existing rows are preserved. Existing orders get payment_status
back-filled to SUCCESS, because under the old code an order only existed
once payment had effectively been taken (wallet debited, or cash/UPI
collected at the counter) -- marking them PENDING would misrepresent
settled history.

Run: python migrate_transaction_core.py
"""

from sqlalchemy import text

from database import engine, Base
import models  # noqa: F401  (registers new tables)

STATEMENTS = [
    # ---- exact money ----
    "ALTER TABLE menu_items ALTER COLUMN price TYPE NUMERIC(12,2) USING ROUND(price::numeric, 2)",
    "ALTER TABLE menu_items ALTER COLUMN gst_rate TYPE NUMERIC(5,2) USING ROUND(gst_rate::numeric, 2)",
    "ALTER TABLE users ALTER COLUMN wallet_balance TYPE NUMERIC(12,2) USING ROUND(COALESCE(wallet_balance,0)::numeric, 2)",
    "ALTER TABLE users ALTER COLUMN wallet_balance SET DEFAULT 0",
    "ALTER TABLE users ALTER COLUMN wallet_balance SET NOT NULL",
    "ALTER TABLE order_items ALTER COLUMN unit_price TYPE NUMERIC(12,2) USING ROUND(unit_price::numeric, 2)",
    "ALTER TABLE order_items ALTER COLUMN gst_rate TYPE NUMERIC(5,2) USING ROUND(gst_rate::numeric, 2)",
    "ALTER TABLE order_items ALTER COLUMN gross_amount TYPE NUMERIC(12,2) USING ROUND(gross_amount::numeric, 2)",
    "ALTER TABLE order_items ALTER COLUMN taxable_amount TYPE NUMERIC(12,2) USING ROUND(taxable_amount::numeric, 2)",
    "ALTER TABLE order_items ALTER COLUMN cgst_amount TYPE NUMERIC(12,2) USING ROUND(cgst_amount::numeric, 2)",
    "ALTER TABLE order_items ALTER COLUMN sgst_amount TYPE NUMERIC(12,2) USING ROUND(sgst_amount::numeric, 2)",
    "ALTER TABLE order_items ALTER COLUMN total_gst_amount TYPE NUMERIC(12,2) USING ROUND(total_gst_amount::numeric, 2)",

    # ---- inventory buckets ----
    "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS reserved INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS committed INTEGER NOT NULL DEFAULT 0",
    "UPDATE menu_items SET stock = 0 WHERE stock IS NULL",
    "ALTER TABLE menu_items ALTER COLUMN stock SET DEFAULT 0",
    "ALTER TABLE menu_items ALTER COLUMN stock SET NOT NULL",

    # ---- the invariants, enforced by the database itself ----
    """DO $$ BEGIN
         ALTER TABLE menu_items ADD CONSTRAINT ck_menu_items_stock_non_negative CHECK (stock >= 0);
       EXCEPTION WHEN duplicate_object THEN NULL; END $$""",
    """DO $$ BEGIN
         ALTER TABLE menu_items ADD CONSTRAINT ck_menu_items_reserved_non_negative CHECK (reserved >= 0);
       EXCEPTION WHEN duplicate_object THEN NULL; END $$""",
    """DO $$ BEGIN
         ALTER TABLE menu_items ADD CONSTRAINT ck_menu_items_committed_non_negative CHECK (committed >= 0);
       EXCEPTION WHEN duplicate_object THEN NULL; END $$""",

    # ---- order payment state ----
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR NOT NULL DEFAULT 'NOT_STARTED'",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2)",
    # Pre-existing orders were only created after money had been taken.
    "UPDATE orders SET payment_status = 'SUCCESS' WHERE payment_status = 'NOT_STARTED'",
    """UPDATE orders o
          SET total_amount = COALESCE((
              SELECT ROUND(SUM(COALESCE(oi.gross_amount, 0))::numeric, 2)
                FROM order_items oi WHERE oi.order_id = o.id), 0)
        WHERE o.total_amount IS NULL""",

    # ---- indexes for real query paths ----
    "CREATE INDEX IF NOT EXISTS ix_orders_canteen_created_at ON orders (canteen_id, created_at)",
    "CREATE INDEX IF NOT EXISTS ix_orders_status ON orders (status)",
    "CREATE INDEX IF NOT EXISTS ix_orders_payment_status ON orders (payment_status)",
    "CREATE INDEX IF NOT EXISTS ix_orders_user ON orders (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_orders_guest ON orders (guest_id)",
    "CREATE INDEX IF NOT EXISTS ix_order_items_order ON order_items (order_id)",
    "CREATE INDEX IF NOT EXISTS ix_menu_items_canteen ON menu_items (canteen_id)",
]

if __name__ == "__main__":
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            conn.execute(text(stmt))
            label = " ".join(stmt.split())[:88]
            print("OK:", label)

    # Creates reservations / payments / payment_events / idempotency_keys
    # and their indexes; existing tables are left untouched.
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        rows = conn.execute(text("""
            SELECT table_name FROM information_schema.tables
             WHERE table_name IN ('reservations','payments','payment_events','idempotency_keys')
             ORDER BY table_name
        """)).fetchall()
        print("\nNew tables present:", [r[0] for r in rows])

    print("Migration complete. Existing data preserved.")

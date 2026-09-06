import sys

# Windows consoles default to cp1252, which can't encode emoji used in
# several existing print()/broadcast log lines (order placement, delivery
# status, websocket connect). Without this, those prints crash with
# UnicodeEncodeError on plain `python -m uvicorn` on Windows -- reconfigure
# stdout/stderr to UTF-8 once here rather than editing every print site.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine

from modules.users.router import router as users_router
from modules.wallet.router import router as wallet_router
from modules.canteens.router import router as canteens_router
from modules.menu.router import router as menu_router
from modules.orders.router import router as orders_router
from modules.admin.router import router as admin_router
from modules.websocket.router import router as websocket_router
from modules.company.router import router as company_router, bootstrap_default_admin
from modules.colleges.router import router as colleges_router
from modules.reports.router import router as reports_router
from modules.payments.router import router as payments_router
from modules.staff.router import router as staff_router
from modules.guests.router import router as guests_router
from modules.verification.router import router as verification_router


app = FastAPI()

SWEEP_INTERVAL_SECONDS = 60


# ============================================================
# LOGGING + ERROR HANDLING
# ============================================================
# Structured-ish single-line logs so a transaction can be traced end to
# end (request -> idempotency key -> order -> reservation -> payment).
# Secrets, tokens and passwords are never logged.

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Malformed input gets a stable code, not a pydantic dump."""
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "INVALID_REQUEST",
                            "message": "The request body or parameters are invalid."}},
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError):
    """
    A database error must never reach the client. The SQL, table names
    and constraint details go to the server log only.
    """
    logging.getLogger("db").exception("db.error path=%s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL_ERROR",
                            "message": "A server error occurred. Please try again."}},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logging.getLogger("app").exception("unhandled path=%s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL_ERROR",
                            "message": "A server error occurred. Please try again."}},
    )


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTERS
# ============================================================

app.include_router(users_router)
app.include_router(wallet_router)
app.include_router(canteens_router)
app.include_router(menu_router)
app.include_router(orders_router)
app.include_router(admin_router)
app.include_router(websocket_router)
app.include_router(company_router)
app.include_router(colleges_router)
app.include_router(reports_router)
app.include_router(payments_router)
app.include_router(staff_router)
app.include_router(guests_router)
app.include_router(verification_router)


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

async def _reservation_sweeper():
    """
    Reclaims inventory from reservations whose hold expired.

    Expiry must never depend on a client telling us it went away -- an
    app that is force-killed, loses battery or drops network still has
    its hold returned here. Runs in-process: no queue/broker is
    warranted at this scale.
    """
    import asyncio

    from database import SessionLocal
    from modules.transactions.inventory import expire_due_reservations

    while True:
        try:
            db = SessionLocal()
            try:
                expire_due_reservations(db)
            finally:
                db.close()
        except Exception:
            logging.getLogger("transactions.sweeper").exception("sweep failed")
        await asyncio.sleep(SWEEP_INTERVAL_SECONDS)


@app.on_event("startup")
async def start_sweeper():
    import asyncio
    asyncio.create_task(_reservation_sweeper())


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations()
    bootstrap_default_admin()


def _apply_lightweight_migrations():
    """
    Base.metadata.create_all() only creates missing TABLES -- it never adds
    a column to a table that already exists. This project doesn't run
    Alembic (see CLAUDE.md section 19), so a new nullable column on an
    existing table needs one explicit, idempotent ALTER here instead of a
    full drop/recreate. Nothing destructive: existing rows just get NULL
    for the new columns.
    """
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE canteens ADD COLUMN IF NOT EXISTS opens_at TIME"))
        conn.execute(text("ALTER TABLE canteens ADD COLUMN IF NOT EXISTS closes_at TIME"))
        conn.execute(text("ALTER TABLE staff_accounts ADD COLUMN IF NOT EXISTS staff_id VARCHAR"))


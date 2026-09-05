from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
from sqlalchemy.orm import Session

from database import get_db
from models import Canteen, College
from auth import require_manager, assert_canteen_in_scope, CurrentAccount
from modules.reports.service import build_daily_report, build_college_daily_report
from modules.reports.pdf_export import build_daily_report_pdf, build_college_report_pdf
from modules.reports.excel_export import build_daily_report_excel, build_college_report_excel


router = APIRouter(
    prefix="/reports",
    tags=["Reports"]
)


def _resolve_college(db: Session, account: CurrentAccount) -> College:
    """College comes from the verified token, never from the request."""
    college = db.query(College).filter(College.id == account.college_id).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
    return college


def _resolve_scope(db: Session, canteen_id: int, account: CurrentAccount):
    """
    Manager-only, tenant-scoped. The college is taken from the verified
    token -- a canteen_id pointing at another college is rejected here,
    never trusted just because the client sent it.
    """
    canteen = db.query(Canteen).filter(Canteen.id == canteen_id).first()

    if not canteen:
        raise HTTPException(status_code=404, detail="Canteen not found")

    assert_canteen_in_scope(account, canteen.college_id, canteen.id)

    college = db.query(College).filter(College.id == account.college_id).first()

    if not college:
        raise HTTPException(status_code=404, detail="College not found")

    return canteen, college


@router.get("/daily")
def get_daily_sales_report(
    canteen_id: int,
    report_date: date,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    canteen, college = _resolve_scope(db, canteen_id, account)
    return build_daily_report(db, canteen, college, report_date)


# ------------------------------------------------------------------
# College-wide: every canteen in the manager's own college, one section
# each plus a combined total. The canteen list is read from the database
# for that college -- nothing is hardcoded, so a new canteen shows up
# without any code change.
# ------------------------------------------------------------------

@router.get("/daily/college")
def get_college_daily_report(
    report_date: date,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    college = _resolve_college(db, account)
    return build_college_daily_report(db, college, report_date)


@router.get("/daily/college/pdf")
def download_college_daily_report_pdf(
    report_date: date,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    college = _resolve_college(db, account)
    report = build_college_daily_report(db, college, report_date)
    pdf_bytes = build_college_report_pdf(report)

    filename = f"sales-gst-report-all-canteens-{report_date.isoformat()}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/daily/college/excel")
def download_college_daily_report_excel(
    report_date: date,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    college = _resolve_college(db, account)
    report = build_college_daily_report(db, college, report_date)
    xlsx_bytes = build_college_report_excel(report)

    filename = f"sales-gst-report-all-canteens-{report_date.isoformat()}.xlsx"

    return StreamingResponse(
        BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/daily/pdf")
def download_daily_sales_report_pdf(
    canteen_id: int,
    report_date: date,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    canteen, college = _resolve_scope(db, canteen_id, account)
    report = build_daily_report(db, canteen, college, report_date)
    pdf_bytes = build_daily_report_pdf(report)

    filename = f"sales-gst-report-{canteen.name.replace(' ', '_')}-{report_date.isoformat()}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/daily/excel")
def download_daily_sales_report_excel(
    canteen_id: int,
    report_date: date,
    account: CurrentAccount = Depends(require_manager),
    db: Session = Depends(get_db)
):
    canteen, college = _resolve_scope(db, canteen_id, account)
    report = build_daily_report(db, canteen, college, report_date)
    xlsx_bytes = build_daily_report_excel(report)

    filename = f"sales-gst-report-{canteen.name.replace(' ', '_')}-{report_date.isoformat()}.xlsx"

    return StreamingResponse(
        BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

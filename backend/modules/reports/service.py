"""
Daily sales & GST report data.

Everything here reads the immutable financial snapshot stored on
OrderItem at sale time. The live MenuItem is used ONLY as a fallback for
rows created before the snapshot columns existed (flagged as estimated),
and for the item's display name.

Filtering, grouping and totalling are pushed into SQL so a day with
thousands of transactions doesn't get pulled into Python.
"""

from datetime import datetime, date, time, timedelta

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from models import Order, OrderItem, MenuItem, User, GuestCustomer, Canteen, College
from utils import IST, to_ist
from modules.reports.tax import DEFAULT_GST_RATE, money

# Statuses treated as completed sales. Money is already taken at order
# creation in this system (wallet debited immediately, counter cash
# collected before entry), so every order placed on the day counts.
# When a cancelled/void/refunded state is introduced, exclude it here and
# it will drop out of every section of the report at once.
SALE_STATUSES = ["PLACED", "PREPARING", "READY", "DELIVERED"]


def _utc_window(report_date: date):
    """
    created_at is stored naive-UTC, but a business day is an IST day.
    Returns the [start, end) naive-UTC window covering that IST date.
    """
    start_ist = datetime.combine(report_date, time.min).replace(tzinfo=IST)
    end_ist = start_ist + timedelta(days=1)
    # Convert to naive UTC to match how created_at is stored.
    start_utc = (start_ist - start_ist.utcoffset()).replace(tzinfo=None)
    end_utc = (end_ist - end_ist.utcoffset()).replace(tzinfo=None)
    return start_utc, end_utc


# ------------------------------------------------------------------
# Snapshot-with-fallback expressions, defined once and reused by every
# query so the JSON, PDF and Excel can never disagree with each other.
# ------------------------------------------------------------------

def _expressions():
    gross = func.coalesce(OrderItem.gross_amount, MenuItem.price * OrderItem.quantity)
    rate = func.coalesce(OrderItem.gst_rate, DEFAULT_GST_RATE)
    taxable = func.coalesce(OrderItem.taxable_amount, gross / (1 + rate / 100.0))
    cgst = func.coalesce(OrderItem.cgst_amount, (gross - taxable) / 2)
    sgst = func.coalesce(OrderItem.sgst_amount, (gross - taxable) / 2)
    total_gst = func.coalesce(OrderItem.total_gst_amount, gross - taxable)
    unit_price = func.coalesce(OrderItem.unit_price, MenuItem.price)
    return gross, rate, taxable, cgst, sgst, total_gst, unit_price


def _base_join(db: Session, canteen_id: int, start_utc, end_utc):
    gross, rate, taxable, cgst, sgst, total_gst, unit_price = _expressions()
    return (
        db.query(OrderItem, Order, MenuItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .filter(
            Order.canteen_id == canteen_id,
            Order.status.in_(SALE_STATUSES),
            Order.created_at >= start_utc,
            Order.created_at < end_utc,
        )
    )


def get_item_summary(db: Session, canteen_id: int, start_utc, end_utc):
    """Item-wise aggregation, grouped in the database."""
    gross, rate, taxable, cgst, sgst, total_gst, _ = _expressions()

    rows = (
        db.query(
            MenuItem.id.label("menu_item_id"),
            MenuItem.name.label("name"),
            rate.label("gst_rate"),
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(gross).label("gross"),
            func.sum(taxable).label("taxable"),
            func.sum(cgst).label("cgst"),
            func.sum(sgst).label("sgst"),
            func.sum(total_gst).label("total_gst"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .filter(
            Order.canteen_id == canteen_id,
            Order.status.in_(SALE_STATUSES),
            Order.created_at >= start_utc,
            Order.created_at < end_utc,
        )
        .group_by(MenuItem.id, MenuItem.name, rate)
        .order_by(func.sum(gross).desc())
        .all()
    )

    return [
        {
            "menu_item_id": r.menu_item_id,
            "name": r.name,
            "gst_rate": money(r.gst_rate),
            "quantity": int(r.qty or 0),
            "gross_amount": money(r.gross),
            "taxable_amount": money(r.taxable),
            "cgst_amount": money(r.cgst),
            "sgst_amount": money(r.sgst),
            "total_gst_amount": money(r.total_gst),
        }
        for r in rows
    ]


def get_payment_summary(db: Session, canteen_id: int, start_utc, end_utc):
    """Gross per payment method, grouped in the database."""
    gross, _, _, _, _, _, _ = _expressions()

    rows = (
        db.query(
            Order.payment_mode.label("mode"),
            func.count(func.distinct(Order.id)).label("orders"),
            func.sum(gross).label("gross"),
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .filter(
            Order.canteen_id == canteen_id,
            Order.status.in_(SALE_STATUSES),
            Order.created_at >= start_utc,
            Order.created_at < end_utc,
        )
        .group_by(Order.payment_mode)
        .all()
    )

    return [
        {
            "payment_mode": r.mode or "UNKNOWN",
            "order_count": int(r.orders or 0),
            "gross_amount": money(r.gross),
        }
        for r in rows
    ]


def get_gst_rate_summary(db: Session, canteen_id: int, start_utc, end_utc):
    """Tax breakdown grouped by the GST rate actually applied at sale time."""
    gross, rate, taxable, cgst, sgst, total_gst, _ = _expressions()

    rows = (
        db.query(
            rate.label("gst_rate"),
            func.sum(gross).label("gross"),
            func.sum(taxable).label("taxable"),
            func.sum(cgst).label("cgst"),
            func.sum(sgst).label("sgst"),
            func.sum(total_gst).label("total_gst"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .filter(
            Order.canteen_id == canteen_id,
            Order.status.in_(SALE_STATUSES),
            Order.created_at >= start_utc,
            Order.created_at < end_utc,
        )
        .group_by(rate)
        .order_by(rate)
        .all()
    )

    return [
        {
            "gst_rate": money(r.gst_rate),
            "gross_amount": money(r.gross),
            "taxable_amount": money(r.taxable),
            "cgst_amount": money(r.cgst),
            "sgst_amount": money(r.sgst),
            "total_gst_amount": money(r.total_gst),
        }
        for r in rows
    ]


def get_totals(db: Session, canteen_id: int, start_utc, end_utc):
    """Day totals, summed in the database at full precision."""
    gross, _, taxable, cgst, sgst, total_gst, _ = _expressions()

    row = (
        db.query(
            func.count(func.distinct(Order.id)).label("orders"),
            func.coalesce(func.sum(OrderItem.quantity), 0).label("qty"),
            func.coalesce(func.sum(gross), 0).label("gross"),
            func.coalesce(func.sum(taxable), 0).label("taxable"),
            func.coalesce(func.sum(cgst), 0).label("cgst"),
            func.coalesce(func.sum(sgst), 0).label("sgst"),
            func.coalesce(func.sum(total_gst), 0).label("total_gst"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .filter(
            Order.canteen_id == canteen_id,
            Order.status.in_(SALE_STATUSES),
            Order.created_at >= start_utc,
            Order.created_at < end_utc,
        )
        .one()
    )

    return {
        "order_count": int(row.orders or 0),
        "item_count": int(row.qty or 0),
        "gross_sales": money(row.gross),
        "taxable_sales": money(row.taxable),
        "cgst_amount": money(row.cgst),
        "sgst_amount": money(row.sgst),
        "total_gst": money(row.total_gst),
    }


def get_transactions(db: Session, canteen_id: int, start_utc, end_utc):
    """Per-order transaction detail with its lines."""
    gross, rate, taxable, cgst, sgst, total_gst, unit_price = _expressions()

    rows = (
        db.query(
            Order.id.label("order_id"),
            Order.created_at.label("created_at"),
            Order.payment_mode.label("payment_mode"),
            Order.order_type.label("order_type"),
            Order.status.label("status"),
            User.name.label("user_name"),
            GuestCustomer.name.label("guest_name"),
            GuestCustomer.guest_code.label("guest_code"),
            MenuItem.name.label("item_name"),
            OrderItem.quantity.label("quantity"),
            unit_price.label("unit_price"),
            rate.label("gst_rate"),
            gross.label("gross"),
            taxable.label("taxable"),
            cgst.label("cgst"),
            sgst.label("sgst"),
            total_gst.label("total_gst"),
            OrderItem.gross_amount.label("raw_snapshot"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .outerjoin(User, User.id == Order.user_id)
        .outerjoin(GuestCustomer, GuestCustomer.id == Order.guest_id)
        .filter(
            Order.canteen_id == canteen_id,
            Order.status.in_(SALE_STATUSES),
            Order.created_at >= start_utc,
            Order.created_at < end_utc,
        )
        .order_by(Order.created_at.asc(), Order.id.asc())
        .all()
    )

    orders = {}
    order_sequence = []

    for r in rows:
        if r.order_id not in orders:
            customer = r.user_name or (f"{r.guest_name} (Guest)" if r.guest_name else "Customer")
            orders[r.order_id] = {
                "order_id": r.order_id,
                "time": to_ist(r.created_at).strftime("%H:%M"),
                "timestamp": to_ist(r.created_at).isoformat(),
                "customer": customer,
                "guest_code": r.guest_code,
                "payment_mode": r.payment_mode or "UNKNOWN",
                "order_type": r.order_type or "-",
                "status": r.status,
                "items": [],
                "gross_amount": 0.0,
                "taxable_amount": 0.0,
                "cgst_amount": 0.0,
                "sgst_amount": 0.0,
                "total_gst_amount": 0.0,
                "has_estimated_values": False,
            }
            order_sequence.append(r.order_id)

        entry = orders[r.order_id]
        entry["items"].append({
            "name": r.item_name,
            "quantity": int(r.quantity or 0),
            "unit_price": money(r.unit_price),
            "gst_rate": money(r.gst_rate),
            "gross_amount": money(r.gross),
            "taxable_amount": money(r.taxable),
            "cgst_amount": money(r.cgst),
            "sgst_amount": money(r.sgst),
            "total_gst_amount": money(r.total_gst),
        })

        entry["gross_amount"] += float(r.gross or 0)
        entry["taxable_amount"] += float(r.taxable or 0)
        entry["cgst_amount"] += float(r.cgst or 0)
        entry["sgst_amount"] += float(r.sgst or 0)
        entry["total_gst_amount"] += float(r.total_gst or 0)

        # No stored snapshot -> value was reconstructed from the live menu.
        if r.raw_snapshot is None:
            entry["has_estimated_values"] = True

    result = []
    for oid in order_sequence:
        o = orders[oid]
        for key in ("gross_amount", "taxable_amount", "cgst_amount", "sgst_amount", "total_gst_amount"):
            o[key] = money(o[key])
        result.append(o)

    return result


def _merge_summaries(sections, key_fields, sum_fields, int_fields=()):
    """Combine per-canteen summary rows into one college-wide list."""
    merged = {}
    for rows in sections:
        for row in rows:
            key = tuple(row[k] for k in key_fields)
            if key not in merged:
                merged[key] = {k: row[k] for k in key_fields}
                for f in list(sum_fields) + list(int_fields):
                    merged[key][f] = 0
            for f in sum_fields:
                merged[key][f] += float(row[f] or 0)
            for f in int_fields:
                merged[key][f] += int(row[f] or 0)

    out = []
    for row in merged.values():
        for f in sum_fields:
            row[f] = money(row[f])
        out.append(row)
    return out


def build_college_daily_report(db: Session, college: College, report_date: date) -> dict:
    """
    College-wide daily report: one section per canteen, plus combined
    totals. Canteens are read from the database for this college -- never
    a fixed list -- so a newly created canteen appears automatically.
    """
    canteens = (
        db.query(Canteen)
        .filter(Canteen.college_id == college.id)
        .order_by(Canteen.name)
        .all()
    )

    sections = [build_daily_report(db, c, college, report_date) for c in canteens]

    grand = {
        "order_count": sum(s["totals"]["order_count"] for s in sections),
        "item_count": sum(s["totals"]["item_count"] for s in sections),
        "gross_sales": money(sum(s["totals"]["gross_sales"] for s in sections)),
        "taxable_sales": money(sum(s["totals"]["taxable_sales"] for s in sections)),
        "cgst_amount": money(sum(s["totals"]["cgst_amount"] for s in sections)),
        "sgst_amount": money(sum(s["totals"]["sgst_amount"] for s in sections)),
        "total_gst": money(sum(s["totals"]["total_gst"] for s in sections)),
    }

    return {
        "college": {"id": college.id, "name": college.name},
        "scope": "college",
        "report_date": report_date.isoformat(),
        "generated_at": to_ist(datetime.utcnow()).isoformat(),
        "canteens": [
            {
                "canteen": s["canteen"],
                "totals": s["totals"],
                "item_summary": s["item_summary"],
                "payment_summary": s["payment_summary"],
                "gst_summary": s["gst_summary"],
                "transactions": s["transactions"],
            }
            for s in sections
        ],
        "combined_item_summary": _merge_summaries(
            [s["item_summary"] for s in sections],
            ["name", "gst_rate"],
            ["gross_amount", "taxable_amount", "cgst_amount", "sgst_amount", "total_gst_amount"],
            ["quantity"],
        ),
        "combined_payment_summary": _merge_summaries(
            [s["payment_summary"] for s in sections],
            ["payment_mode"],
            ["gross_amount"],
            ["order_count"],
        ),
        "combined_gst_summary": _merge_summaries(
            [s["gst_summary"] for s in sections],
            ["gst_rate"],
            ["gross_amount", "taxable_amount", "cgst_amount", "sgst_amount", "total_gst_amount"],
        ),
        "grand_totals": grand,
        "excluded_orders": [],
        "contains_estimated_values": any(s["contains_estimated_values"] for s in sections),
    }


def build_daily_report(db: Session, canteen: Canteen, college: College, report_date: date) -> dict:
    start_utc, end_utc = _utc_window(report_date)

    transactions = get_transactions(db, canteen.id, start_utc, end_utc)

    return {
        "college": {"id": college.id, "name": college.name},
        "canteen": {"id": canteen.id, "name": canteen.name},
        "report_date": report_date.isoformat(),
        "generated_at": to_ist(datetime.utcnow()).isoformat(),
        "transactions": transactions,
        "item_summary": get_item_summary(db, canteen.id, start_utc, end_utc),
        "payment_summary": get_payment_summary(db, canteen.id, start_utc, end_utc),
        "gst_summary": get_gst_rate_summary(db, canteen.id, start_utc, end_utc),
        "totals": get_totals(db, canteen.id, start_utc, end_utc),
        # Reserved for cancelled/voided/refunded sales. No such order state
        # exists yet, so this is always empty today -- when one is added,
        # exclude it from SALE_STATUSES and populate this instead.
        "excluded_orders": [],
        "contains_estimated_values": any(t["has_estimated_values"] for t in transactions),
    }

"""
Daily Sales & GST report -> PDF.

Renders the same report dict the JSON endpoint returns, so the printed
document and the on-screen figures can never diverge. Deliberately plain:
this is an accounting record, not a dashboard screenshot.
"""

from io import BytesIO
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)

INK = colors.HexColor("#1a1a1a")
MUTED = colors.HexColor("#5a5a5a")
RULE = colors.HexColor("#9a9a9a")
BAND = colors.HexColor("#f2f2f2")


def _styles():
    s = getSampleStyleSheet()
    return {
        "org": ParagraphStyle("org", parent=s["Title"], fontName="Helvetica-Bold",
                              fontSize=15, leading=18, textColor=INK, alignment=1, spaceAfter=2),
        "doc": ParagraphStyle("doc", parent=s["Normal"], fontName="Helvetica",
                              fontSize=10.5, leading=13, textColor=MUTED, alignment=1, spaceAfter=10),
        "section": ParagraphStyle("section", parent=s["Normal"], fontName="Helvetica-Bold",
                                  fontSize=9.5, leading=12, textColor=INK, spaceBefore=10, spaceAfter=5),
        "meta": ParagraphStyle("meta", parent=s["Normal"], fontName="Helvetica",
                               fontSize=8.5, leading=11.5, textColor=INK),
        "foot": ParagraphStyle("foot", parent=s["Normal"], fontName="Helvetica",
                               fontSize=7.5, leading=10, textColor=MUTED),
    }


def _money(v) -> str:
    return f"{float(v or 0):,.2f}"


def _fmt_date(iso: str) -> str:
    try:
        return date.fromisoformat(iso).strftime("%d %B %Y")
    except Exception:
        return iso


def _table(data, widths, align_right_from=1, font_size=7.5, header=True):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("ALIGN", (align_right_from, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#dcdcdc")),
    ]
    if header:
        style += [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND", (0, 0), (-1, 0), BAND),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE),
            ("LINEABOVE", (0, 0), (-1, 0), 0.6, RULE),
        ]
    t.setStyle(TableStyle(style))
    return t


def build_college_report_pdf(report: dict) -> bytes:
    """
    College-wide report: a per-canteen breakdown, each canteen's own item
    and GST summary, then combined totals across every canteen.
    """
    buf = BytesIO()
    st = _styles()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=13 * mm, bottomMargin=13 * mm,
        title=f"Daily Sales & GST Report (All Canteens) - {report['report_date']}",
        author="College Saapadu",
    )

    el = []
    el.append(Paragraph("COLLEGE SAAPADU", st["org"]))
    el.append(Paragraph("Daily Sales &amp; GST Report - All Canteens", st["doc"]))

    meta = [
        [Paragraph(f"<b>College:</b> {report['college']['name']}", st["meta"]),
         Paragraph(f"<b>Report Date:</b> {_fmt_date(report['report_date'])}", st["meta"])],
        [Paragraph(f"<b>Canteens:</b> {len(report['canteens'])}", st["meta"]),
         Paragraph(f"<b>Generated:</b> {report['generated_at'][:19].replace('T', ' ')} IST", st["meta"])],
    ]
    mt = Table(meta, colWidths=[92 * mm, 90 * mm], hAlign="LEFT")
    mt.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, -1), (-1, -1), 0.8, RULE),
    ]))
    el.append(mt)

    # ---------- Canteen-wise summary (the headline table) ----------
    rows = [["Canteen", "Orders", "Items", "Gross Sales", "Taxable Value", "CGST", "SGST", "Total GST"]]
    for sec in report["canteens"]:
        t = sec["totals"]
        rows.append([
            sec["canteen"]["name"], str(t["order_count"]), str(t["item_count"]),
            _money(t["gross_sales"]), _money(t["taxable_sales"]),
            _money(t["cgst_amount"]), _money(t["sgst_amount"]), _money(t["total_gst"]),
        ])
    g = report["grand_totals"]
    rows.append([
        "TOTAL (ALL CANTEENS)", str(g["order_count"]), str(g["item_count"]),
        _money(g["gross_sales"]), _money(g["taxable_sales"]),
        _money(g["cgst_amount"]), _money(g["sgst_amount"]), _money(g["total_gst"]),
    ])

    summary_tbl = _table(
        rows,
        widths=[44 * mm, 15 * mm, 14 * mm, 24 * mm, 26 * mm, 20 * mm, 20 * mm, 21 * mm],
        align_right_from=1, font_size=8,
    )
    summary_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, RULE),
        ("LINEBELOW", (0, -1), (-1, -1), 0.8, RULE),
        ("BACKGROUND", (0, -1), (-1, -1), BAND),
    ]))
    el.append(Paragraph("CANTEEN-WISE SUMMARY", st["section"]))
    el.append(summary_tbl)

    # ---------- Combined item summary ----------
    item_rows = [["Item", "Qty", "GST %", "Gross Sales", "Taxable Value", "CGST", "SGST", "Total GST"]]
    for it in report["combined_item_summary"]:
        item_rows.append([
            it["name"], str(it["quantity"]), f"{it['gst_rate']:g}%",
            _money(it["gross_amount"]), _money(it["taxable_amount"]),
            _money(it["cgst_amount"]), _money(it["sgst_amount"]), _money(it["total_gst_amount"]),
        ])
    if len(item_rows) == 1:
        item_rows.append(["No items sold", "-", "-", "-", "-", "-", "-", "-"])

    el.append(KeepTogether([
        Paragraph("ITEM-WISE SUMMARY (ALL CANTEENS)", st["section"]),
        _table(item_rows,
               widths=[46 * mm, 12 * mm, 14 * mm, 24 * mm, 26 * mm, 20 * mm, 20 * mm, 20 * mm],
               align_right_from=1, font_size=8),
    ]))

    # ---------- Combined payment + GST ----------
    pay_rows = [["Payment Method", "Orders", "Amount"]]
    pay_total = 0.0
    for p in report["combined_payment_summary"]:
        pay_rows.append([p["payment_mode"], str(p["order_count"]), _money(p["gross_amount"])])
        pay_total += float(p["gross_amount"])
    pay_rows.append(["Total", "", _money(pay_total)])
    pay_tbl = _table(pay_rows, widths=[46 * mm, 22 * mm, 30 * mm], align_right_from=1, font_size=8)
    pay_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.6, RULE),
    ]))

    gst_rows = [["GST Rate", "Gross", "Taxable Value", "CGST", "SGST", "Total GST"]]
    for gr in report["combined_gst_summary"]:
        gst_rows.append([
            f"{gr['gst_rate']:g}%", _money(gr["gross_amount"]), _money(gr["taxable_amount"]),
            _money(gr["cgst_amount"]), _money(gr["sgst_amount"]), _money(gr["total_gst_amount"]),
        ])
    if len(gst_rows) == 1:
        gst_rows.append(["-", "-", "-", "-", "-", "-"])

    el.append(KeepTogether([
        Paragraph("PAYMENT SUMMARY (ALL CANTEENS)", st["section"]),
        pay_tbl,
        Paragraph("GST SUMMARY BY RATE (ALL CANTEENS)", st["section"]),
        _table(gst_rows,
               widths=[20 * mm, 26 * mm, 30 * mm, 24 * mm, 24 * mm, 26 * mm],
               align_right_from=1, font_size=8),
    ]))

    # ---------- Per-canteen detail ----------
    for sec in report["canteens"]:
        t = sec["totals"]
        detail = [["Item", "Qty", "GST %", "Gross", "Taxable", "CGST", "SGST", "Total GST"]]
        for it in sec["item_summary"]:
            detail.append([
                it["name"], str(it["quantity"]), f"{it['gst_rate']:g}%",
                _money(it["gross_amount"]), _money(it["taxable_amount"]),
                _money(it["cgst_amount"]), _money(it["sgst_amount"]), _money(it["total_gst_amount"]),
            ])
        if len(detail) == 1:
            detail.append(["No sales recorded", "-", "-", "-", "-", "-", "-", "-"])
        detail.append([
            "Canteen Total", str(t["item_count"]), "",
            _money(t["gross_sales"]), _money(t["taxable_sales"]),
            _money(t["cgst_amount"]), _money(t["sgst_amount"]), _money(t["total_gst"]),
        ])

        d_tbl = _table(detail,
                       widths=[46 * mm, 12 * mm, 14 * mm, 24 * mm, 26 * mm, 20 * mm, 20 * mm, 20 * mm],
                       align_right_from=1, font_size=7.5)
        d_tbl.setStyle(TableStyle([
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("LINEABOVE", (0, -1), (-1, -1), 0.6, RULE),
        ]))

        el.append(KeepTogether([
            Paragraph(f"{sec['canteen']['name'].upper()} - ITEM DETAIL "
                      f"({t['order_count']} orders)", st["section"]),
            d_tbl,
        ]))

    if report.get("contains_estimated_values"):
        el.append(Spacer(1, 6))
        el.append(Paragraph(
            "Note: some lines predate per-transaction tax capture and were reconstructed "
            "from current menu pricing. They are indicative, not an audited historical record.",
            st["foot"]))

    el.append(Spacer(1, 8))
    el.append(Paragraph(
        "Computer-generated report. Amounts are GST inclusive at point of sale; "
        "taxable value and GST are extracted from the inclusive amount.", st["foot"]))

    doc.build(el)
    return buf.getvalue()


def build_daily_report_pdf(report: dict) -> bytes:
    buf = BytesIO()
    st = _styles()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=13 * mm, bottomMargin=13 * mm,
        title=f"Daily Sales & GST Report - {report['report_date']}",
        author="College Saapadu",
    )

    el = []
    el.append(Paragraph("COLLEGE SAAPADU", st["org"]))
    el.append(Paragraph("Daily Sales &amp; GST Report", st["doc"]))

    meta = [
        [Paragraph(f"<b>College:</b> {report['college']['name']}", st["meta"]),
         Paragraph(f"<b>Report Date:</b> {_fmt_date(report['report_date'])}", st["meta"])],
        [Paragraph(f"<b>Canteen:</b> {report['canteen']['name']}", st["meta"]),
         Paragraph(f"<b>Generated:</b> {report['generated_at'][:19].replace('T', ' ')} IST", st["meta"])],
    ]
    mt = Table(meta, colWidths=[92 * mm, 90 * mm], hAlign="LEFT")
    mt.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, -1), (-1, -1), 0.8, RULE),
    ]))
    el.append(mt)
    el.append(Spacer(1, 4))

    # ---------------- Transactions ----------------
    el.append(Paragraph("TRANSACTION DETAILS", st["section"]))
    rows = [["S.No", "Order", "Time", "Item", "Qty", "Rate", "Gross", "Taxable", "CGST", "SGST", "GST", "Pay"]]
    n = 0
    for txn in report["transactions"]:
        for item in txn["items"]:
            n += 1
            rows.append([
                str(n), f"#{txn['order_id']}", txn["time"], item["name"], str(item["quantity"]),
                _money(item["unit_price"]), _money(item["gross_amount"]), _money(item["taxable_amount"]),
                _money(item["cgst_amount"]), _money(item["sgst_amount"]), _money(item["total_gst_amount"]),
                txn["payment_mode"],
            ])
    if n == 0:
        rows.append(["-", "-", "-", "No transactions recorded", "-", "-", "-", "-", "-", "-", "-", "-"])

    el.append(_table(
        rows,
        widths=[10 * mm, 13 * mm, 12 * mm, 37 * mm, 9 * mm, 14 * mm, 16 * mm, 16 * mm, 14 * mm, 14 * mm, 14 * mm, 13 * mm],
        align_right_from=4,
    ))

    # ---------------- Item summary ----------------
    item_rows = [["Item", "Qty", "GST %", "Gross Sales", "Taxable Value", "CGST", "SGST", "Total GST"]]
    for it in report["item_summary"]:
        item_rows.append([
            it["name"], str(it["quantity"]), f"{it['gst_rate']:g}%",
            _money(it["gross_amount"]), _money(it["taxable_amount"]),
            _money(it["cgst_amount"]), _money(it["sgst_amount"]), _money(it["total_gst_amount"]),
        ])
    if len(item_rows) == 1:
        item_rows.append(["No items sold", "-", "-", "-", "-", "-", "-", "-"])

    el.append(KeepTogether([
        Paragraph("ITEM-WISE SALES SUMMARY", st["section"]),
        _table(item_rows,
               widths=[46 * mm, 12 * mm, 14 * mm, 24 * mm, 26 * mm, 20 * mm, 20 * mm, 20 * mm],
               align_right_from=1, font_size=8),
    ]))

    # ---------------- Payment summary ----------------
    pay_rows = [["Payment Method", "Orders", "Amount"]]
    pay_total = 0.0
    for p in report["payment_summary"]:
        pay_rows.append([p["payment_mode"], str(p["order_count"]), _money(p["gross_amount"])])
        pay_total += float(p["gross_amount"])
    pay_rows.append(["Total", "", _money(pay_total)])

    pay_tbl = _table(pay_rows, widths=[46 * mm, 22 * mm, 30 * mm], align_right_from=1, font_size=8)
    pay_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.6, RULE),
    ]))

    # ---------------- GST summary ----------------
    gst_rows = [["GST Rate", "Gross", "Taxable Value", "CGST", "SGST", "Total GST"]]
    for g in report["gst_summary"]:
        gst_rows.append([
            f"{g['gst_rate']:g}%", _money(g["gross_amount"]), _money(g["taxable_amount"]),
            _money(g["cgst_amount"]), _money(g["sgst_amount"]), _money(g["total_gst_amount"]),
        ])
    if len(gst_rows) == 1:
        gst_rows.append(["-", "-", "-", "-", "-", "-"])

    el.append(KeepTogether([
        Paragraph("PAYMENT SUMMARY", st["section"]),
        pay_tbl,
        Paragraph("GST SUMMARY (BY RATE)", st["section"]),
        _table(gst_rows,
               widths=[20 * mm, 26 * mm, 30 * mm, 24 * mm, 24 * mm, 26 * mm],
               align_right_from=1, font_size=8),
    ]))

    # ---------------- Daily totals ----------------
    t = report["totals"]
    total_rows = [
        ["Total Orders", str(t["order_count"])],
        ["Total Items Sold", str(t["item_count"])],
        ["Gross Sales (GST inclusive)", _money(t["gross_sales"])],
        ["Taxable Sales Value", _money(t["taxable_sales"])],
        ["CGST", _money(t["cgst_amount"])],
        ["SGST", _money(t["sgst_amount"])],
        ["Total GST Collected", _money(t["total_gst"])],
    ]
    tt = Table(total_rows, colWidths=[70 * mm, 40 * mm], hAlign="RIGHT")
    tt.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#dcdcdc")),
        ("LINEABOVE", (0, 0), (-1, 0), 0.6, RULE),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.6, RULE),
        ("LINEBELOW", (0, -1), (-1, -1), 0.6, RULE),
    ]))
    el.append(KeepTogether([Paragraph("DAILY TOTALS", st["section"]), tt]))

    if report.get("contains_estimated_values"):
        el.append(Spacer(1, 6))
        el.append(Paragraph(
            "Note: some lines predate per-transaction tax capture and were reconstructed "
            "from current menu pricing. They are indicative, not an audited historical record.",
            st["foot"]))

    el.append(Spacer(1, 8))
    el.append(Paragraph(
        "Computer-generated report. Amounts are GST inclusive at point of sale; "
        "taxable value and GST are extracted from the inclusive amount.", st["foot"]))

    doc.build(el)
    return buf.getvalue()

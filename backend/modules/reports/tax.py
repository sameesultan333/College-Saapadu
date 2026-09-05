"""
GST calculation for GST-INCLUSIVE prices.

All arithmetic uses Decimal. Binary floating point is not acceptable for
authoritative money: 0.1 + 0.2 != 0.3 in float, and those errors compound
across thousands of transactions in a tax report.

The price stored on a MenuItem is what the customer pays -- it already
contains GST -- so tax is extracted out of the gross amount, never added
on top of it:

    multiplier = 1 + (gst_rate / 100)
    taxable    = gross / multiplier
    total_gst  = gross - taxable
    cgst       = total_gst / 2
    sgst       = total_gst / 2

Computing `gross * gst_rate/100` would treat a GST-inclusive price as if
it were exclusive and overstate the tax.

Rounding: each stored line is quantised to 2dp with ROUND_HALF_UP (the
conventional rule for invoices), and CGST/SGST are split so the two
halves always add back to total_gst exactly -- no stray paisa.
"""

from decimal import Decimal, ROUND_HALF_UP

DEFAULT_GST_RATE = Decimal("5.00")
TWO_PLACES = Decimal("0.01")


def to_decimal(value) -> Decimal:
    """Coerce anything (float, int, str, Decimal, None) to Decimal safely."""
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    # str() first: Decimal(float) would import the float's binary error.
    return Decimal(str(value))


def quantize(value) -> Decimal:
    return to_decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def gst_multiplier(gst_rate) -> Decimal:
    return Decimal("1") + (to_decimal(gst_rate) / Decimal("100"))


def compute_line_tax(unit_price, quantity: int, gst_rate) -> dict:
    """Financial snapshot for one order line, from a GST-inclusive price."""
    unit_price = to_decimal(unit_price)
    qty = Decimal(int(quantity or 0))
    rate = to_decimal(gst_rate if gst_rate is not None else DEFAULT_GST_RATE)

    gross = quantize(unit_price * qty)

    # Round the HALF, not the total. CGST and SGST are legally equal
    # halves, so they must never differ by a stray paisa -- rounding the
    # total first and subtracting would produce e.g. 0.48/0.47.
    raw_gst = gross - (gross / gst_multiplier(rate))
    half = quantize(raw_gst / Decimal("2"))

    cgst = half
    sgst = half
    total_gst = cgst + sgst

    # Derive taxable from the rounded tax so the invoice reconciles
    # exactly: taxable + cgst + sgst == gross, to the paisa.
    taxable = gross - total_gst

    return {
        "unit_price": quantize(unit_price),
        "quantity": int(quantity or 0),
        "gst_rate": to_decimal(rate),
        "gross_amount": gross,
        "taxable_amount": taxable,
        "cgst_amount": cgst,
        "sgst_amount": sgst,
        "total_gst_amount": total_gst,
    }


def money(value) -> float:
    """
    Presentation helper for JSON/reporting output.

    Authoritative values stay Decimal in the database; this converts a
    already-summed Decimal to a 2dp float purely for serialisation.
    """
    return float(quantize(value))

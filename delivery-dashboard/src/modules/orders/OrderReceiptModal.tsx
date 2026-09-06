import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Banknote, QrCode, TriangleAlert, X } from "lucide-react";

import { totalAmount, customerCategoryMeta } from "./orderUtils";
import { DeliveryOrder } from "./OrdersSection";

interface OrderReceiptModalProps {
  order: DeliveryOrder;
  onClose: () => void;
  onMarkReady: () => void;
  onStartScan: () => void;
}

/* ------------------------------------------------------------------ */
/* Motion — the receipt "prints" out of the slot. One shot, guarded.   */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Receipt paper + edge treatments. The zigzag is the classic two-
   gradient trick: triangle teeth of the paper color bitten out of a
   transparent strip, so the paper reads as torn, not rounded.        */
/* ------------------------------------------------------------------ */

const PAPER = "var(--bc-color-surface-base, #fffdf8)";
const INK = "var(--bc-color-text-primary, #2b231c)";
const MONO = "var(--bc-login-font-family-mono, 'JetBrains Mono', ui-monospace, monospace)";

const OVERLAY: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--bc-color-surface-overlay, rgba(43, 35, 28, 0.5))",
  backdropFilter: "blur(3px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000, // original stacking preserved
  padding: "var(--bc-space-16, 16px)",
  fontFamily: "var(--bc-font-family, inherit)",
};

const SLIDE: CSSProperties = {
  width: "min(100%, 380px)",
  maxHeight: "92vh",
  overflowY: "auto",
  overscrollBehavior: "contain",
};

/* Teeth strip — sits above/below the paper, same color as the paper */
const TEETH = (flipped: boolean): CSSProperties => ({
  height: 10,
  background: `linear-gradient(-45deg, ${PAPER} 5px, transparent 0), linear-gradient(45deg, ${PAPER} 5px, transparent 0)`,
  backgroundSize: "12px 12px",
  backgroundRepeat: "repeat-x",
  backgroundPosition: flipped ? "left top" : "left bottom",
  transform: flipped ? "scaleY(-1)" : undefined,
  flex: "none",
});

const SHEET: CSSProperties = {
  background: PAPER,
  padding: "var(--bc-space-24, 24px) var(--bc-space-20, 20px)",
  color: INK,
  minWidth: 0,
};

/* Dashed rule — the receipt's structural line */
const RULE: CSSProperties = {
  border: 0,
  borderTop: "1.5px dashed var(--bc-color-border-default, #ddd0b5)",
  margin: "var(--bc-space-16, 16px) 0",
};

const CENTER_ORNAMENT: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--bc-color-border-strong, #a8916a)",
  fontSize: 10,
  letterSpacing: "0.5em",
  margin: "var(--bc-space-12, 12px) 0",
};
const ORNAMENT_LINE: CSSProperties = { flex: 1, borderTop: "1.5px dashed var(--bc-color-border-default, #ddd0b5)" };

/* ------------------------------------------------------------------ */
/* Content styles                                                      */
/* ------------------------------------------------------------------ */

const CLOSE: CSSProperties = {
  position: "absolute",
  top: "var(--bc-space-8, 8px)",
  right: "var(--bc-space-8, 8px)",
  display: "grid",
  placeItems: "center",
  width: 36,
  height: 36,
  padding: 0,
  border: 0,
  borderRadius: "var(--bc-radius-round, 50%)",
  backgroundColor: "transparent",
  color: "var(--bc-color-text-muted, #6e6455)",
  cursor: "pointer",
};

const BRAND_LINE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 700,
  letterSpacing: "0.32em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted, #6e6455)",
  textAlign: "center",
};

const CANTEEN_LINE: CSSProperties = {
  margin: "var(--bc-space-4, 4px) 0 0",
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 600,
  color: "var(--bc-color-text-secondary, #5b4f41)",
  textAlign: "center",
};

const ORDER_LABEL: CSSProperties = {
  margin: "var(--bc-space-16, 16px) 0 0",
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 600,
  letterSpacing: "0.28em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted, #6e6455)",
  textAlign: "center",
};

const ORDER_NUMBER: CSSProperties = {
  margin: "var(--bc-space-4, 4px) 0 0",
  fontFamily: MONO,
  fontSize: "2.1rem",
  fontWeight: 700,
  letterSpacing: "0.02em",
  fontVariantNumeric: "tabular-nums",
  color: INK,
  textAlign: "center",
  lineHeight: 1.1,
};

const SECTION_TITLE: CSSProperties = {
  margin: "0 0 var(--bc-space-8, 8px)",
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted, #6e6455)",
};

const ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--bc-space-12, 12px)",
  padding: "var(--bc-space-4, 4px) 0",
  minWidth: 0,
};
const ROW_LABEL: CSSProperties = {
  flex: "none",
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  color: "var(--bc-color-text-muted, #6e6455)",
};
const ROW_VALUE: CSSProperties = {
  fontWeight: 600,
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  color: INK,
  textAlign: "right",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/* Item line — qty + name, dotted leader, mono amount */
const ITEM: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  padding: "5px 0",
  minWidth: 0,
};
const ITEM_QTY: CSSProperties = {
  flex: "none",
  fontFamily: MONO,
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 700,
  color: "var(--bc-color-text-secondary, #5b4f41)",
  fontVariantNumeric: "tabular-nums",
};
const ITEM_NAME: CSSProperties = {
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  fontWeight: 500,
  color: INK,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const LEADER: CSSProperties = {
  flex: 1,
  minWidth: 16,
  borderBottom: "1px dotted var(--bc-color-border-strong, #a8916a)",
  transform: "translateY(-3px)",
};
const ITEM_AMOUNT: CSSProperties = {
  flex: "none",
  fontFamily: MONO,
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: INK,
};

const TOTAL_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--bc-space-12, 12px)",
  paddingTop: "var(--bc-space-8, 8px)",
};
const TOTAL_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-secondary, #5b4f41)",
};
const TOTAL_VALUE: CSSProperties = {
  fontFamily: MONO,
  fontSize: "1.9rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  fontVariantNumeric: "tabular-nums",
  color: INK,
  lineHeight: 1.1,
};

/* Rubber stamp — rotated, bordered, mono. CASH DUE vs PAID. */
const stamp = (tone: "due" | "paid"): CSSProperties => ({
  display: "block",
  width: "fit-content",
  margin: "var(--bc-space-12, 12px) auto 0",
  padding: "5px 14px",
  transform: "rotate(-4deg)",
  border: `2.5px solid ${tone === "due" ? "var(--bc-color-brand-action, #d96f2b)" : "var(--bc-color-success, #3a6f44)"}`,
  borderRadius: "var(--bc-radius-sm, 6px)",
  fontFamily: MONO,
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: tone === "due" ? "var(--bc-color-brand-action-hover, #bf5d20)" : "var(--bc-color-success-strong, #254c2d)",
  backgroundColor: tone === "due" ? "var(--bc-color-brand-action-faint, #fdf3e8)" : "var(--bc-color-success-bg, #e7f2e5)",
  opacity: 0.92,
});

/* Cash reminder — same sentence as the original, receipt-note styling */
const CASH_NOTE: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-8, 8px)",
  margin: "var(--bc-space-12, 12px) 0 0",
  padding: "var(--bc-space-8, 8px) var(--bc-space-12, 12px)",
  border: "1px dashed var(--bc-color-brand-action, #d96f2b)",
  borderRadius: "var(--bc-radius-sm, 6px)",
  backgroundColor: "var(--bc-color-brand-action-faint, #fdf3e8)",
};
const CASH_NOTE_TEXT: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  lineHeight: 1.5,
  color: "var(--bc-color-text-primary, #2b231c)",
};

/* Tear line with punch holes — the holes are the overlay showing through */
const TEAR: CSSProperties = {
  position: "relative",
  borderTop: "2px dashed var(--bc-color-border-default, #ddd0b5)",
  margin: "var(--bc-space-16, 16px) calc(-1 * var(--bc-space-20, 20px)) 0",
};
const PUNCH = (side: "left" | "right"): CSSProperties => ({
  position: "absolute",
  top: -8,
  [side]: -11,
  width: 16,
  height: 16,
  borderRadius: "var(--bc-radius-round, 50%)",
  backgroundColor: "#241d17", // composited overlay tone; reads as a punched hole
} as CSSProperties);

const ACTION_STRIP: CSSProperties = { padding: "var(--bc-space-16, 16px) 0 0" };

const ACTION = (handoff: boolean, hovered: boolean): CSSProperties => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--bc-space-8, 8px)",
  minHeight: 52,
  border: "1px solid transparent",
  borderRadius: "var(--bc-radius-md, 8px)",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
  cursor: "pointer",
  font: "inherit",
  fontFamily: "var(--bc-font-family, inherit)",
  color: "var(--bc-color-text-inverse, #fffdf9)",
  backgroundColor: handoff
    ? hovered
      ? "var(--bc-dlv-color-accent-strong, #b8732a)"
      : "var(--bc-dlv-color-accent, #d98e3b)"
    : hovered
      ? "var(--bc-color-brand-primary-hover, #17301f)"
      : "var(--bc-color-brand-primary, #1e3b2b)",
  transition: "background-color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease)",
});

const ACTION_CAPTION: CSSProperties = {
  margin: "var(--bc-space-8, 8px) 0 0",
  textAlign: "center",
  fontSize: "var(--bc-font-size-caption, 0.75rem)",
  color: "var(--bc-color-text-muted, #6e6455)",
};

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

/**
 * Full order detail modal shown when a card is tapped. Offers the
 * appropriate next action depending on order status: "Mark Ready" while
 * PREPARING, or "Scan QR to Verify" once READY.
 *
 * Rendered as a thermal-printed order ticket — paper, mono numerals,
 * dot leaders, stamp — rather than a generic card.
 */
export default function OrderReceiptModal({ order, onClose, onMarkReady, onStartScan }: OrderReceiptModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const isPreparing = order.status === "PREPARING";
  const isCash = order.payment_mode === "CASH";
  const category = customerCategoryMeta(order.customer_category);

  /* Print-out-of-the-slot entrance */
  useEffect(() => {
    if (REDUCED_MOTION || !sheetRef.current) return;
    const animation = sheetRef.current.animate(
      [{ opacity: 0, transform: "translateY(-18px)" }, { opacity: 1, transform: "none" }],
      { duration: 300, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  /* Escape closes — keyboard exit the original never had */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={OVERLAY} onClick={onClose} role="presentation">
      <div style={SLIDE}>
        <div style={TEETH(true)} aria-hidden="true" />

        <div
          ref={sheetRef}
          style={SHEET}
          role="dialog"
          aria-modal="true"
          aria-label={`Order receipt #${order.order_id}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" style={CLOSE} onClick={onClose} aria-label="Close receipt">
            <X size={17} strokeWidth={2.25} aria-hidden="true" />
          </button>

          {/* Letterhead */}
          <p style={BRAND_LINE}>College Saapaadu</p>
          {order.canteen_name && <p style={CANTEEN_LINE}>{order.canteen_name}</p>}

          <hr style={RULE} />

          <p style={ORDER_LABEL}>Order</p>
          <p style={ORDER_NUMBER}>#{order.order_id}</p>

          <div style={CENTER_ORNAMENT} aria-hidden="true">
            <span style={ORNAMENT_LINE} />
            ✕
            <span style={ORNAMENT_LINE} />
          </div>

          {/* Customer -- never assume "Student": a walk-in guest may have
              declared themselves a parent or staff member at the counter. */}
          <p style={SECTION_TITLE}>{category.emoji} {category.label}</p>
          <div style={ROW}>
            <span style={ROW_LABEL}>Name</span>
            <span style={ROW_VALUE}>{order.student_name}</span>
          </div>
          {order.phone && (
            <div style={ROW}>
              <span style={ROW_LABEL}>Phone</span>
              <span style={ROW_VALUE}>{order.phone}</span>
            </div>
          )}
          <div style={ROW}>
            <span style={ROW_LABEL}>Payment</span>
            <span
              style={{
                ...ROW_VALUE,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: isCash ? "var(--bc-color-brand-action-hover, #bf5d20)" : "var(--bc-color-success-strong, #254c2d)",
              }}
            >
              {isCash ? <Banknote size={14} strokeWidth={2.25} aria-hidden="true" /> : <QrCode size={14} strokeWidth={2.25} aria-hidden="true" />}
              {isCash ? "Cash on Pickup" : "Online Paid"}
            </span>
          </div>

          <div style={CENTER_ORNAMENT} aria-hidden="true">
            <span style={ORNAMENT_LINE} />
            ✕
            <span style={ORNAMENT_LINE} />
          </div>

          {/* Items */}
          <p style={SECTION_TITLE}>Items</p>
          {order.items.map((item, i) => (
            <div key={i} style={ITEM}>
              <span style={ITEM_QTY}>{item.quantity}×</span>
              <span style={ITEM_NAME} title={item.name}>{item.name}</span>
              <span style={LEADER} aria-hidden="true" />
              <span style={ITEM_AMOUNT}>₹{((item.price || 0) * item.quantity).toFixed(2)}</span>
            </div>
          ))}

          <hr style={RULE} />

          {/* Total + stamp */}
          <div style={TOTAL_ROW}>
            <span style={TOTAL_LABEL}>Total</span>
            <span style={TOTAL_VALUE}>₹{totalAmount(order.items)}</span>
          </div>

          <span style={stamp(isCash ? "due" : "paid")}>
            {isCash ? `Cash Due ₹${totalAmount(order.items)}` : "Paid"}
          </span>

          {isCash && (
            <div style={CASH_NOTE}>
              <TriangleAlert size={15} strokeWidth={2.25} style={{ flex: "none", marginTop: 1, color: "var(--bc-color-brand-action, #d96f2b)" }} aria-hidden="true" />
              <p style={CASH_NOTE_TEXT}>
                Remember to collect <strong>₹{totalAmount(order.items)}</strong> cash before handing over the food!
              </p>
            </div>
          )}

          {/* Tear, then act */}
          <div style={TEAR} aria-hidden="true">
            <span style={PUNCH("left")} />
            <span style={PUNCH("right")} />
          </div>

          <div style={ACTION_STRIP}>
            {isPreparing ? (
              <button type="button" style={ACTION(false, false)} onClick={onMarkReady}>
                Mark Ready for Pickup
              </button>
            ) : (
              <>
                <button type="button" style={ACTION(true, false)} onClick={onStartScan}>
                  <QrCode size={17} strokeWidth={2.25} aria-hidden="true" />
                  Scan Student QR to Verify
                </button>
                <p style={ACTION_CAPTION}>Verification requires the student&apos;s campus QR.</p>
              </>
            )}
          </div>
        </div>

        <div style={TEETH(false)} aria-hidden="true" />
      </div>
    </div>
  );
}
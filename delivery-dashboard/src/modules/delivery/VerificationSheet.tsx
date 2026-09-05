import { useEffect, useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Banknote, CircleCheck, PackageCheck } from "lucide-react";

import { totalAmount } from "../orders/orderUtils";
import { DeliveryOrder } from "../orders/OrdersSection";

interface VerificationSheetProps {
  order: DeliveryOrder | null;
  onComplete: (order: DeliveryOrder) => void;
  onCancel: () => void;
}

/* ------------------------------------------------------------------ */
/* Language — the completion stub. Teal = verified (matches the
   scanner's success state), amber = handoff action, stamps decide the
   money question exactly as the receipt did.                          */
/* ------------------------------------------------------------------ */

const MONO = "var(--bc-login-font-family-mono, 'JetBrains Mono', ui-monospace, monospace)";

/* ------------------------------------------------------------------ */
/* Factories — standalone (a CSSProperties Record cannot hold fns)     */
/* ------------------------------------------------------------------ */

/* Spring slide — a slight overshoot is the honest bottom-sheet feel.
   The theme's global prefers-reduced-motion rule (0.01ms !important)
   beats this inline transition, so no extra guard is needed. */
const SHEET = (open: boolean): CSSProperties => ({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 1100, // original stacking preserved — above scanner (200) and receipt (1000)
  maxWidth: 520,
  marginInline: "auto",
  background: "var(--bc-color-surface-raised, #fff)",
  borderRadius: "var(--bc-radius-xl, 16px) var(--bc-radius-xl, 16px) 0 0",
  borderTop: "3px solid var(--bc-dlv-color-accent-2, #4c8f7a)",
  boxShadow: "var(--bc-shadow-overlay, 0 24px 64px rgba(20, 16, 12, 0.3))",
  transform: open ? "translateY(0)" : "translateY(105%)",
  transition: "transform 380ms cubic-bezier(0.175, 0.885, 0.32, 1.05)",
  maxHeight: "86vh",
  overflowY: "auto",
  overscrollBehavior: "contain",
  visibility: open ? "visible" : "hidden", // closed sheet never traps a tap or a screen reader
  transitionProperty: "transform, visibility",
  transitionDelay: open ? "0ms, 0ms" : "0ms, 380ms",
});

const stamp = (tone: "due" | "paid"): CSSProperties => ({
  display: "block",
  width: "fit-content",
  margin: "0 auto",
  padding: "5px 14px",
  transform: "rotate(-3deg)",
  border: `2.5px solid ${tone === "due" ? "var(--bc-color-brand-action, #d96f2b)" : "var(--bc-color-success, #3a6f44)"}`,
  borderRadius: "var(--bc-radius-sm, 6px)",
  fontFamily: MONO,
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: tone === "due" ? "var(--bc-color-brand-action-hover, #bf5d20)" : "var(--bc-color-success-strong, #254c2d)",
  backgroundColor: tone === "due" ? "var(--bc-color-brand-action-faint, #fdf3e8)" : "var(--bc-color-success-bg, #e7f2e5)",
  opacity: 0.94,
});

const PRIMARY = (hovered: boolean): CSSProperties => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--bc-space-8, 8px)",
  minHeight: 54,
  border: "1px solid transparent",
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: hovered
    ? "var(--bc-dlv-color-accent-strong, #b8732a)"
    : "var(--bc-dlv-color-accent, #d98e3b)",
  color: "#14100b",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
  cursor: "pointer",
  font: "inherit",
  transition: "background-color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease)",
});

const CANCEL = (hovered: boolean): CSSProperties => ({
  width: "100%",
  minHeight: 48,
  border: `1px solid ${hovered ? "var(--bc-color-border-strong, #a8916a)" : "var(--bc-color-border-default, #ddd0b5)"}`,
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: hovered ? "var(--bc-color-surface-page-alt, #fdf8ef)" : "transparent",
  color: "var(--bc-color-text-secondary, #5b4f41)",
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  fontWeight: 600,
  cursor: "pointer",
  font: "inherit",
  transition:
    "background-color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease), border-color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease)",
});

/* ------------------------------------------------------------------ */
/* Static styles                                                       */
/* ------------------------------------------------------------------ */

/* New, flagged: dim backdrop behind the sheet. Inert while closed. */
const BACKDROP = (open: boolean): CSSProperties => ({
  position: "fixed",
  inset: 0,
  zIndex: 1090, // below the sheet, above the receipt/scanner chrome
  backgroundColor: "var(--bc-color-surface-overlay, rgba(43, 35, 28, 0.5))",
  opacity: open ? 1 : 0,
  pointerEvents: open ? "auto" : "none",
  transition: "opacity 300ms var(--bc-motion-easing-standard, ease)",
});

const GRAB: CSSProperties = {
  width: 40,
  height: 4,
  borderRadius: "var(--bc-radius-pill, 999px)",
  backgroundColor: "var(--bc-color-border-strong, #a8916a)",
  margin: "var(--bc-space-12, 12px) auto var(--bc-space-4, 4px)",
};

const CONTENT: CSSProperties = {
  padding: "var(--bc-space-16, 16px) var(--bc-space-24, 24px) calc(var(--bc-space-24, 24px) + env(safe-area-inset-bottom))",
  textAlign: "center",
};

const MEDALLION: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 64,
  height: 64,
  margin: "0 auto",
  borderRadius: "var(--bc-radius-round, 50%)",
  backgroundColor: "rgba(76, 143, 122, 0.14)",
  border: "2.5px solid var(--bc-dlv-color-accent-2, #4c8f7a)",
  color: "var(--bc-dlv-color-accent-2, #4c8f7a)",
};

const HEADING: CSSProperties = {
  margin: "var(--bc-space-12, 12px) 0 0",
  fontSize: "var(--bc-font-size-page-heading, 1.5rem)",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--bc-color-text-primary, #2b231c)",
};
const SUB: CSSProperties = {
  margin: "var(--bc-space-4, 4px) 0 0",
  fontFamily: MONO,
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-muted, #6e6455)",
};

/* Collection panel — the money question, ticket-styled */
const PANEL = (cash: boolean): CSSProperties => ({
  margin: "var(--bc-space-20, 20px) 0",
  padding: "var(--bc-space-20, 20px)",
  borderRadius: "var(--bc-radius-lg, 12px)",
  border: cash
    ? "1.5px dashed var(--bc-color-brand-action, #d96f2b)"
    : "1px solid var(--bc-color-success-border, #c7e0c1)",
  backgroundColor: cash
    ? "var(--bc-color-brand-action-faint, #fdf3e8)"
    : "var(--bc-color-success-bg, #e7f2e5)",
  display: "grid",
  gap: "var(--bc-space-8, 8px)",
  justifyItems: "center",
});

const PANEL_LABEL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-secondary, #5b4f41)",
};
const PANEL_AMOUNT: CSSProperties = {
  fontFamily: MONO,
  fontSize: "2.4rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary, #2b231c)",
};
const PANEL_NOTE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 600,
  color: "var(--bc-color-text-muted, #6e6455)",
};

const ACTIONS: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--bc-space-8, 8px)",
};

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

/**
 * Bottom sheet shown after a QR scan successfully verifies an order.
 * Staff confirms cash/online payment status, then hands over the food.
 * Stays mounted (transformed off-screen) so its slide-up transition can
 * play — matches the original markup/behavior.
 */
export default function VerificationSheet({ order, onComplete, onCancel }: VerificationSheetProps) {
  const open = Boolean(order);
  const primaryRef = useRef<HTMLButtonElement>(null);

  /* Keyboard path + focus: Escape cancels while open; the primary action
     receives focus on open so Enter confirms immediately. */
  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <>
      {/* Backdrop tap = cancel (flagged addition) */}
      <div style={BACKDROP(open)} onClick={open ? onCancel : undefined} aria-hidden="true" />

      <div
        style={SHEET(open)}
        role="dialog"
        aria-modal="true"
        aria-label={order ? `Confirm handoff for order ${order.order_id}` : undefined}
      >
        <span style={GRAB} aria-hidden="true" />

        {order && (
          <div style={CONTENT}>
            <span style={MEDALLION} aria-hidden="true">
              <CircleCheck size={30} strokeWidth={2.25} />
            </span>

            <h3 style={HEADING}>Student Verified!</h3>
            <p style={SUB}>
              Order #{order.order_id} confirmed
              {order.student_name ? ` · ${order.student_name}` : ""}
            </p>

            <div style={PANEL(order.payment_mode === "CASH")}>
              {order.payment_mode === "CASH" ? (
                <>
                  <span style={PANEL_LABEL}>
                    <Banknote size={15} strokeWidth={2.25} aria-hidden="true" />
                    Collect cash before serving
                  </span>
                  <span style={stamp("due")}>Cash due</span>
                  <span style={PANEL_AMOUNT}>₹{totalAmount(order.items)}</span>
                  <p style={PANEL_NOTE}>Make sure you have received the cash!</p>
                </>
              ) : (
                <>
                  <span style={PANEL_LABEL}>
                    <CircleCheck size={15} strokeWidth={2.25} aria-hidden="true" />
                    Payment complete
                  </span>
                  <span style={stamp("paid")}>Paid</span>
                  <span style={PANEL_AMOUNT}>₹{totalAmount(order.items)}</span>
                  <p style={PANEL_NOTE}>Online payment verified</p>
                </>
              )}
            </div>

            <div style={ACTIONS}>
              <button
                ref={primaryRef}
                type="button"
                style={PRIMARY(false)}
                onClick={() => onComplete(order)}
              >
                <PackageCheck size={17} strokeWidth={2.25} aria-hidden="true" />
                Hand Over Food &amp; Close
              </button>
              <button type="button" style={CANCEL(false)} onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
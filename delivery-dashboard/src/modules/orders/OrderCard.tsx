import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Banknote, CheckCircle2, FileText, QrCode } from "lucide-react";

import { totalAmount, customerCategoryMeta } from "./orderUtils";
import { DeliveryOrder, OrderVariant } from "./OrdersSection";

interface OrderCardProps {
  order: DeliveryOrder;
  variant: OrderVariant;
  onSelect: (order: DeliveryOrder) => void;
  onPrimaryAction: (order: DeliveryOrder) => void;
}

/* ------------------------------------------------------------------ */
/* Motion / responsive guard                                           */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Variant semantics — the OrderTabs two-stage system, carried down:   */
/* amber = kitchen at work, teal = handoff.                            */
/* ------------------------------------------------------------------ */

interface VariantMeta {
  spine: string;      // card top rail
  pillBg: string;
  pillText: string;
  itemsLabel: string; // section label copy
  qtyColor: string;   // mono quantity accent
}

const VARIANT_META: Record<OrderVariant, VariantMeta> = {
  preparing: {
    spine: "var(--bc-color-brand-action, #d96f2b)",
    pillBg: "var(--bc-color-brand-action-soft, #fdf3e8)",
    pillText: "var(--bc-color-brand-action-hover, #bf5d20)",
    itemsLabel: "Prepare now",
    qtyColor: "var(--bc-color-brand-action-hover, #bf5d20)",
  },
  ready: {
    spine: "var(--bc-dlv-color-accent-2, #4c8f7a)",
    pillBg: "rgba(76, 143, 122, 0.12)",
    pillText: "#35705c",
    itemsLabel: "Ready to serve",
    qtyColor: "#35705c",
  },
};

const MONO = "var(--bc-login-font-family-mono, 'JetBrains Mono', ui-monospace, monospace)";

/* ------------------------------------------------------------------ */
/* Factories                                                           */
/* ------------------------------------------------------------------ */

const cardStyle = (meta: VariantMeta, hovered: boolean): CSSProperties => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "var(--bc-space-8, 8px)",
  padding: "var(--bc-space-16, 16px)",
  borderTop: `3px solid ${meta.spine}`,
  border: "1px solid var(--bc-color-border-subtle)",
  borderTopWidth: 3,
  borderTopColor: meta.spine,
  borderRadius: "var(--bc-radius-lg, 12px)",
  backgroundColor: "var(--bc-color-surface-base, #fffdf8)",
  boxShadow: hovered ? "var(--bc-shadow-card-hover)" : "var(--bc-shadow-card)",
  transform: hovered ? "translateY(-2px)" : "none",
  cursor: "pointer",
  minWidth: 0,
  transition:
    "box-shadow var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease), transform var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease)",
});

const statePill = (meta: VariantMeta): CSSProperties => ({
  flex: "none",
  padding: "3px 10px",
  borderRadius: "var(--bc-radius-pill, 999px)",
  backgroundColor: meta.pillBg,
  color: meta.pillText,
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

/* Cash-due chip — the loud one, only when money is owed at handoff */
const cashChip: CSSProperties = {
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 10px",
  borderRadius: "var(--bc-radius-pill, 999px)",
  backgroundColor: "var(--bc-color-brand-action-faint, #fdf3e8)",
  border: "1px dashed var(--bc-color-brand-action, #d96f2b)",
  color: "var(--bc-color-brand-action-hover, #bf5d20)",
  fontFamily: MONO,
  fontSize: "var(--bc-font-size-caption, 0.75rem)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const ghostButton = (hovered: boolean): CSSProperties => ({
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 44,
  padding: "0 var(--bc-space-12, 12px)",
  border: `1px solid ${hovered ? "var(--bc-color-border-strong, #a8916a)" : "var(--bc-color-border-default, #ddd0b5)"}`,
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: hovered ? "var(--bc-color-surface-page-alt, #fdf8ef)" : "transparent",
  color: "var(--bc-color-text-secondary, #5b4f41)",
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 600,
  cursor: "pointer",
  font: "inherit",
  transition:
    "background-color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease), border-color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease)",
});

/* Primary CTA — forest = kitchen-system action (Mark Ready),
   amber = handoff action (Verify & Serve), matching the receipt modal. */
const primaryButton = (isReady: boolean, hovered: boolean): CSSProperties => ({
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  minHeight: 44,
  padding: "0 var(--bc-space-12, 12px)",
  border: "1px solid transparent",
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: isReady
    ? hovered
      ? "var(--bc-dlv-color-accent-strong, #b8732a)"
      : "var(--bc-dlv-color-accent, #d98e3b)"
    : hovered
      ? "var(--bc-color-brand-primary-hover, #17301f)"
      : "var(--bc-color-brand-primary, #1e3b2b)",
  color: "var(--bc-color-text-inverse, #fffdf9)",
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 700,
  whiteSpace: "nowrap",
  cursor: "pointer",
  font: "inherit",
  transition:
    "background-color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease)",
});

/* ------------------------------------------------------------------ */
/* Static styles                                                       */
/* ------------------------------------------------------------------ */

const RULE: CSSProperties = {
  border: 0,
  borderTop: "1.5px dashed var(--bc-color-border-default, #ddd0b5)",
  margin: 0,
};

const HEAD_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--bc-space-8, 8px)",
};
const ORDER_NO: CSSProperties = {
  fontFamily: MONO,
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary, #2b231c)",
};

const STUDENT: CSSProperties = {
  fontSize: "1.0625rem", // bumped up for visibility
  fontWeight: 700,
  color: "var(--bc-color-text-primary, #2b231c)",
  lineHeight: 1.2, // let it wrap instead of hiding
};
const STUDENT_LABEL: CSSProperties = {
  flex: "none",
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)", // bumped up
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted, #6e6455)",
};

const PAY_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-8, 8px)",
  minWidth: 0,
};
const PAY_TEXT: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 600,
  color: "var(--bc-color-text-secondary, #5b4f41)",
  whiteSpace: "nowrap",
};

/* Item row — the payload zone. Qty is the scan target: large bold mono.
   A faint surface lifts the block from the ticket's rules. */
const ITEMS_BLOCK: CSSProperties = {
  display: "grid",
  gap: "var(--bc-space-2, 2px)",
  padding: "var(--bc-space-8, 8px) var(--bc-space-12, 12px)",
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: "var(--bc-color-surface-page-alt, #fdf8ef)",
};

const ITEMS_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted, #6e6455)",
  marginBottom: "var(--bc-space-4, 4px)",
};

const ITEM_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-12, 12px)",
  padding: "var(--bc-space-4, 4px) 0",
  minWidth: 0,
};

/* Quantity — big, bold, mono, variant-tinted: read it from arm's length */
const itemQty = (color: string): CSSProperties => ({
  flex: "none",
  minWidth: 44, // bumped slightly for the badge padding
  textAlign: "center", // centered inside the badge
  fontFamily: MONO,
  fontSize: "1.375rem", // ~22px — the largest type on the card below the total
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  color,
  backgroundColor: "rgba(0, 0, 0, 0.04)", // badge background to pop out
  padding: "4px 8px",
  borderRadius: "var(--bc-radius-md, 8px)",
});

const ITEM_NAME: CSSProperties = {
  fontSize: "1.0625rem", // bumped up further
  fontWeight: 600,
  color: "var(--bc-color-text-primary, #2b231c)",
  lineHeight: 1.3, // let long menu items wrap instead of cutting off
  minWidth: 0,
};

/* Total strip — the receipt's total row, compact */
const TOTAL_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--bc-space-8, 8px)",
  paddingTop: "var(--bc-space-8, 8px)",
};
const TOTAL_COUNT: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  color: "var(--bc-color-text-muted, #6e6455)",
};
const TOTAL_VALUE: CSSProperties = {
  fontFamily: MONO,
  fontSize: "var(--bc-font-size-lg, 1.0625rem)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary, #2b231c)",
};

/* Tear before the actions — the ticket's stub line */
const TEAR: CSSProperties = {
  position: "relative",
  borderTop: "2px dashed var(--bc-color-border-default, #ddd0b5)",
  margin: "var(--bc-space-8, 8px) calc(-1 * var(--bc-space-16, 16px)) 0",
};
const PUNCH = (side: "left" | "right"): CSSProperties => ({
  position: "absolute",
  top: -7,
  [side]: -10,
  width: 14,
  height: 14,
  borderRadius: "var(--bc-radius-round, 50%)",
  backgroundColor: "var(--bc-color-surface-page, #f8f1e4)",
  border: "1px solid var(--bc-color-border-default, #ddd0b5)",
} as CSSProperties);

const FOOTER: CSSProperties = {
  display: "flex",
  gap: "var(--bc-space-8, 8px)",
  paddingTop: "var(--bc-space-12, 12px)",
};

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

/**
 * A single order card, rendered inside the "In Kitchen" (preparing) or
 * "Ready to Serve" (ready) grid. `variant` controls the copy/labels and
 * which primary action button is shown; the underlying order data shape
 * is identical either way.
 *
 * Rendered as a mini dispatch ticket — spine, mono order number, tear
 * line — so the queue reads as a rail of awaiting slips.
 */
export default function OrderCard({ order, variant, onSelect, onPrimaryAction }: OrderCardProps) {
  const meta = VARIANT_META[variant];
  const isReady = variant === "ready";
  const isCash = order.payment_mode === "CASH";
  const category = customerCategoryMeta(order.customer_category);

  const [hovered, setHovered] = useState(false);
  const [hoverDetails, setHoverDetails] = useState(false);
  const [hoverPrimary, setHoverPrimary] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION || !cardRef.current) return;
    const animation = cardRef.current.animate(
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: 240, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  return (
    <article
      ref={cardRef}
      style={cardStyle(meta, hovered)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(order)}
    >
      {/* Ticket head */}
      <div style={HEAD_ROW}>
        <span style={ORDER_NO}>#{order.order_id}</span>
        <span style={statePill(meta)}>{isReady ? "Ready" : "Preparing"}</span>
      </div>

      <hr style={RULE} />

      {/* Student + payment */}
      <div style={{ display: "grid", gap: "var(--bc-space-4, 4px)", minWidth: 0 }}>
        <div style={{ ...PAY_ROW, flexWrap: "wrap" }}>
          <span style={STUDENT_LABEL}>{category.emoji} {category.label}</span>
          <span style={STUDENT} title={order.student_name}>{order.student_name}</span>
        </div>
        <div style={PAY_ROW}>
          <span style={PAY_TEXT}>
            {isCash ? (
              <>
                <Banknote size={14} strokeWidth={2.1} aria-hidden="true" />
                Cash
              </>
            ) : (
              <>
                <QrCode size={14} strokeWidth={2.1} aria-hidden="true" />
                Paid online
              </>
            )}
          </span>
          {isReady && isCash && (
            <span style={cashChip}>Collect ₹{totalAmount(order.items)}</span>
          )}
        </div>
      </div>

      <hr style={RULE} />

      {/* Items — the contents check */}
      <div style={ITEMS_BLOCK}>
        <span style={ITEMS_LABEL}>{meta.itemsLabel}</span>
        {order.items.map((item, i) => (
          <div key={i} style={ITEM_ROW}>
            <span style={itemQty(meta.qtyColor)}>{item.quantity}</span>
            <span style={ITEM_NAME} title={item.name}>{item.name}</span>
          </div>
        ))}
      </div>

      <div style={TOTAL_ROW}>
        <span style={TOTAL_COUNT}>
          {order.items.length} {order.items.length === 1 ? "item" : "items"}
        </span>
        <span style={TOTAL_VALUE}>₹{totalAmount(order.items)}</span>
      </div>

      {/* Tear — information above, action below */}
      <div style={TEAR} aria-hidden="true">
        <span style={PUNCH("left")} />
        <span style={PUNCH("right")} />
      </div>

      <div style={FOOTER}>
        <button
          type="button"
          style={ghostButton(hoverDetails)}
          aria-label={`View details for order ${order.order_id}`}
          onMouseEnter={() => setHoverDetails(true)}
          onMouseLeave={() => setHoverDetails(false)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(order);
          }}
        >
          <FileText size={15} strokeWidth={2.1} aria-hidden="true" />
          Details
        </button>
        <button
          type="button"
          style={primaryButton(isReady, hoverPrimary)}
          onMouseEnter={() => setHoverPrimary(true)}
          onMouseLeave={() => setHoverPrimary(false)}
          onClick={(e) => {
            e.stopPropagation();
            onPrimaryAction(order);
          }}
        >
          {isReady ? (
            <>
              <QrCode size={15} strokeWidth={2.25} aria-hidden="true" />
              Verify &amp; Serve
            </>
          ) : (
            <>
              <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden="true" />
              Mark Ready for Pickup
            </>
          )}
        </button>
      </div>
    </article>
  );
}
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { ChefHat, PackageCheck } from "lucide-react";

import OrderCard from "./OrderCard";

export interface DeliveryOrderItem {
  name: string;
  quantity: number;
  price?: number;
}

export type CustomerCategory = "STUDENT" | "PARENT" | "STAFF";

export interface DeliveryOrder {
  order_id: number;
  student_name: string;
  // Who the customer actually declared themselves as at the counter (or
  // their account role for a registered order) -- a walk-in guest is
  // never necessarily a student, so this backs the order card's label
  // instead of a hardcoded assumption. Optional/loose because it's new;
  // an older cached order shape without it should still render sanely.
  customer_category?: CustomerCategory | string;
  phone?: string;
  payment_mode: string;
  status: string;
  items: DeliveryOrderItem[];
  canteen_id?: number;
  canteen_name?: string;
}

export type OrderVariant = "preparing" | "ready";

interface OrdersSectionProps {
  variant: OrderVariant;
  orders: DeliveryOrder[];
  onSelectOrder: (order: DeliveryOrder) => void;
  onPrimaryAction: (order: DeliveryOrder) => void;
}

/* ------------------------------------------------------------------ */
/* Variant semantics — mirrors OrderTabs: amber = in motion (kitchen), */
/* teal = handoff (the RouteMark pin color). Text tones are derived    */
/* darker variants for AA on the tinted chip; keep in sync with the    */
/* token values (#d96f2b / #4c8f7a).                                   */
/* ------------------------------------------------------------------ */

interface VariantMeta {
  chip: string;       // chip fill
  chipText: string;   // chip text (AA-checked)
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  emptyIconTint: string;
  emptyIconBg: string;
}

const VARIANT_META: Record<OrderVariant, VariantMeta> = {
  preparing: {
    chip: "var(--bc-color-brand-action-soft, #fdf3e8)",
    chipText: "var(--bc-color-brand-action-hover, #bf5d20)",
    eyebrow: "Stage 1 · Kitchen",
    title: "Orders Being Prepared",
    description: "Wait for kitchen to finish, then mark ready for pickup",
    emptyTitle: "Kitchen is quiet",
    emptyBody: "No orders being prepared right now",
    emptyIconTint: "var(--bc-color-brand-action, #d96f2b)",
    emptyIconBg: "var(--bc-color-brand-action-soft, #fdf3e8)",
  },
  ready: {
    chip: "rgba(76, 143, 122, 0.12)",
    chipText: "#35705c",
    eyebrow: "Stage 2 · Handoff",
    title: "Ready for Pickup",
    description: "Verify student ID before handing over food",
    emptyTitle: "No orders ready",
    emptyBody: "Mark orders as ready from the Kitchen tab",
    emptyIconTint: "var(--bc-dlv-color-accent-2, #4c8f7a)",
    emptyIconBg: "rgba(76, 143, 122, 0.12)",
  },
};

/* ------------------------------------------------------------------ */
/* Motion — one settle-in; hover lives on OrderCard itself             */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Static styles                                                       */
/* ------------------------------------------------------------------ */

const ROOT: CSSProperties = { display: "grid", gap: "var(--bc-space-16, 16px)", minWidth: 0 };

const HEAD: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "var(--bc-space-12, 12px)",
  flexWrap: "wrap",
};
const HEAD_COPY: CSSProperties = { display: "grid", gap: "var(--bc-space-4, 4px)", minWidth: 0 };
const EYEBROW: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted)",
};
const TITLE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-page-heading, 1.5rem)",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  lineHeight: 1.2,
  color: "var(--bc-color-text-primary)",
};
const DESCRIPTION: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  color: "var(--bc-color-text-muted)",
};

const CHIP: CSSProperties = {
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 12px",
  borderRadius: "var(--bc-radius-pill, 999px)",
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
  gap: "var(--bc-space-16, 16px)",
  alignItems: "start",
};

const EMPTY: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-8, 8px)",
  padding: "var(--bc-space-56, 56px) var(--bc-space-24, 24px)",
  background: "var(--bc-color-surface-raised, #fff)",
  border: "1px dashed var(--bc-color-border-default)",
  borderRadius: "var(--bc-radius-lg, 12px)",
  textAlign: "center",
};
const EMPTY_ICON: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 52,
  height: 52,
  borderRadius: "var(--bc-radius-round, 50%)",
};
const EMPTY_TITLE: CSSProperties = {
  margin: "var(--bc-space-4, 4px) 0 0",
  fontSize: "var(--bc-font-size-section-heading, 1.125rem)",
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
};
const EMPTY_BODY: CSSProperties = {
  margin: 0,
  maxWidth: "42ch",
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  color: "var(--bc-color-text-muted)",
};

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

/**
 * One tab's worth of content: heading, empty state, and the order grid.
 * Used for both the "preparing" and "ready" tabs — `variant` drives the
 * copy and which OrderCard layout/action is shown.
 */
export default function OrdersSection({ variant, orders, onSelectOrder, onPrimaryAction }: OrdersSectionProps) {
  const meta = VARIANT_META[variant];
  const Icon = variant === "ready" ? PackageCheck : ChefHat;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION || !rootRef.current) return;
    const animation = rootRef.current.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  return (
    <div ref={rootRef} style={ROOT}>
      <header style={HEAD}>
        <div style={HEAD_COPY}>
          <p style={EYEBROW}>{meta.eyebrow}</p>
          <h2 style={TITLE}>{meta.title}</h2>
          <p style={DESCRIPTION}>{meta.description}</p>
        </div>
        <span style={{ ...CHIP, backgroundColor: meta.chip, color: meta.chipText }}>
          <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
          {orders.length} {orders.length === 1 ? "order" : "orders"}
        </span>
      </header>

      {orders.length === 0 ? (
        <div style={EMPTY}>
          <span style={{ ...EMPTY_ICON, backgroundColor: meta.emptyIconBg, color: meta.emptyIconTint }} aria-hidden="true">
            <Icon size={22} strokeWidth={1.75} />
          </span>
          <h3 style={EMPTY_TITLE}>{meta.emptyTitle}</h3>
          <p style={EMPTY_BODY}>{meta.emptyBody}</p>
        </div>
      ) : (
        <div style={GRID}>
          {orders.map((order) => (
            <OrderCard
              key={order.order_id}
              order={order}
              variant={variant}
              onSelect={onSelectOrder}
              onPrimaryAction={onPrimaryAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
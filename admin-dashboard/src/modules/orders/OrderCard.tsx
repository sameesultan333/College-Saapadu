import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BellRing,
  ChevronRight,
  CircleCheck,
  CircleDot,
  ClipboardList,
  Clock3,
  Flame,
  Loader2,
  Smartphone,
  Store,
} from "lucide-react";
import type { OrderRecord } from "./ActiveOrdersTab";

/* ------------------------------------------------------------------ */
/* Contract                                                            */
/* ------------------------------------------------------------------ */

interface OrderCardProps {
  order: OrderRecord;
  getTimeAgo: (timestamp: string) => string;
  onStartPreparing: (orderId: number) => void;
  onViewDetails: (order: OrderRecord) => void;
  onConfirmPayment?: (orderId: number) => void;
  confirmingPayment?: boolean;
}

/* ------------------------------------------------------------------ */
/* Lookup tables — plain data, no per-render recreation                */
/* ------------------------------------------------------------------ */

interface ChannelMeta {
  label: string;
  icon: LucideIcon;
}

const CHANNEL_META: Record<string, ChannelMeta> = {
  CASH: { label: "Counter", icon: Store },
};
const ONLINE_CHANNEL: ChannelMeta = { label: "Online", icon: Smartphone };

interface StatusMeta {
  label: string;
  icon: LucideIcon;
  modifier: string;
}

/* Rail + badge hues follow the kitchen workflow:
   amber = needs action → blue = in progress → green = done. */
const STATUS_META: Record<string, StatusMeta> = {
  PLACED: { label: "Placed", icon: ClipboardList, modifier: "placed" },
  PREPARING: { label: "Preparing", icon: Flame, modifier: "preparing" },
  READY: { label: "Ready", icon: BellRing, modifier: "ready" },
};

const AWAITING_PAYMENT_STATES = new Set(["PENDING", "NOT_STARTED"]);

const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getStatusMeta = (status: string): StatusMeta =>
  STATUS_META[status] ?? {
    label: titleCase(status) || "Unknown",
    icon: CircleDot,
    modifier: "neutral",
  };

const getChannelMeta = (paymentMode: string): ChannelMeta =>
  CHANNEL_META[paymentMode] ?? ONLINE_CHANNEL;

const formatAmount = (amount: number): string =>
  `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ------------------------------------------------------------------ */
/* Stylesheet — embedded via React 19's hoisted <style> (one instance  */
/* in <head> per page, deduped by href, no matter how many cards       */
/* mount). Consumes --bc-* tokens only; delete OrderCard.css.          */
/* ------------------------------------------------------------------ */

const ORDER_CARD_CSS = `
.oc{position:relative;display:grid;gap:var(--bc-space-12);background:var(--bc-color-surface-raised);border:1px solid var(--bc-color-border-subtle);border-radius:var(--bc-radius-lg);box-shadow:var(--bc-shadow-card);padding:var(--bc-space-card-padding);overflow:hidden;transition:box-shadow var(--bc-motion-duration-normal) var(--bc-motion-easing-standard)}
.oc:hover{box-shadow:var(--bc-shadow-card-hover)}
.oc::before{content:"";position:absolute;top:0;bottom:0;left:0;width:3px;background:var(--oc-rail,var(--bc-color-neutral-border-strong))}
.oc--placed{--oc-rail:var(--bc-color-warning-light)}
.oc--preparing{--oc-rail:var(--bc-color-info)}
.oc--ready{--oc-rail:var(--bc-color-success)}
.oc--neutral{--oc-rail:var(--bc-color-neutral-border-strong)}

/* Header */
.oc-head{display:flex;align-items:center;gap:var(--bc-space-8);min-width:0}
.oc-id{font-size:var(--bc-font-size-card-title);font-weight:700;letter-spacing:var(--bc-letter-spacing-tight);font-variant-numeric:tabular-nums;color:var(--bc-color-text-primary)}
.oc-channel{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:var(--bc-radius-pill);background:var(--bc-color-neutral-bg);color:var(--bc-color-neutral-text);font-size:var(--bc-font-size-eyebrow);font-weight:600;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap}
.oc-time{display:inline-flex;align-items:center;gap:5px;margin-left:auto;color:var(--bc-color-text-muted);font-size:var(--bc-font-size-caption,0.75rem);font-variant-numeric:tabular-nums;white-space:nowrap}

/* Customer */
.oc-customer{display:flex;align-items:center;gap:var(--bc-space-8)}
.oc-avatar{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:var(--bc-radius-round);background:var(--bc-color-brand-primary-soft);color:var(--bc-color-brand-primary);font-size:var(--bc-font-size-secondary);font-weight:700}
.oc-name{font-size:var(--bc-font-size-body);font-weight:600;color:var(--bc-color-text-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Items — receipt-style dot leaders */
.oc-items{display:grid;gap:6px;margin:0;padding:0;list-style:none}
.oc-item{display:flex;align-items:baseline;gap:var(--bc-space-8);font-size:var(--bc-font-size-secondary);color:var(--bc-color-text-primary)}
.oc-item-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oc-item-leader{flex:1;min-width:12px;border-bottom:1px dotted var(--bc-color-border-default);transform:translateY(-3px)}
.oc-item-qty{flex:none;font-weight:600;color:var(--bc-color-text-secondary);font-variant-numeric:tabular-nums}
.oc-total-label{color:var(--bc-color-text-muted);text-transform:uppercase;font-size:var(--bc-font-size-eyebrow);letter-spacing:0.06em;font-weight:600}
.oc-total-amount{font-weight:700;font-size:var(--bc-font-size-body);color:var(--bc-color-text-primary);font-variant-numeric:tabular-nums}

/* Badges */
.oc-badges{display:flex;flex-wrap:wrap;align-items:center;gap:var(--bc-space-8)}
.oc-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--bc-radius-pill);font-size:var(--bc-font-size-caption,0.75rem);font-weight:600;letter-spacing:0.01em;white-space:nowrap}
.oc-badge--placed{background:var(--bc-color-warning-bg);color:var(--bc-color-warning-strong)}
.oc-badge--preparing{background:var(--bc-color-info-bg);color:var(--bc-color-info-strong)}
.oc-badge--ready{background:var(--bc-color-success-bg);color:var(--bc-color-success-strong)}
.oc-badge--neutral{background:var(--bc-color-neutral-bg);color:var(--bc-color-neutral-text)}
.oc-badge--due{background:var(--bc-color-danger-bg);color:var(--bc-color-danger)}
.oc-badge--paid{background:var(--bc-color-success-bg);color:var(--bc-color-success-strong)}

/* Actions */
.oc-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--bc-space-8);margin-top:2px}
.oc-spacer{flex:1}
.oc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 var(--bc-space-16);border:1px solid transparent;border-radius:var(--bc-radius-md);font-size:var(--bc-font-size-secondary);font-weight:600;cursor:pointer;font:inherit;transition:background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard),color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard),border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)}
.oc-btn:disabled{opacity:0.55;cursor:not-allowed}
.oc-btn--brand{background:var(--bc-color-brand-primary);color:var(--bc-color-text-inverse)}
.oc-btn--brand:hover:not(:disabled){background:var(--bc-color-brand-primary-hover)}
.oc-btn--settle{background:var(--bc-color-success);color:var(--bc-color-text-inverse)}
.oc-btn--settle:hover:not(:disabled){background:var(--bc-color-success-strong)}
.oc-btn--ghost{background:transparent;border-color:var(--bc-color-border-default);color:var(--bc-color-text-secondary)}
.oc-btn--ghost:hover{background:var(--bc-color-surface-page-alt);border-color:var(--bc-color-border-strong);color:var(--bc-color-text-primary)}
.oc-note{display:inline-flex;align-items:center;gap:6px;font-size:var(--bc-font-size-secondary);font-weight:600}
.oc-note--info{color:var(--bc-color-info)}
.oc-note--success{color:var(--bc-color-success-strong)}

.oc-spin{animation:oc-spin 0.9s linear infinite}
@keyframes oc-spin{to{transform:rotate(360deg)}}

/* Adaptive */
@media (max-width:420px){
  .oc{padding:var(--bc-space-16)}
  .oc-actions{flex-direction:column;align-items:stretch}
  .oc-actions .oc-spacer{display:none}
  .oc-btn{width:100%;min-height:44px}
  .oc-note{min-height:44px;justify-content:center}
}
`;

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export default function OrderCard({
  order,
  getTimeAgo,
  onStartPreparing,
  onViewDetails,
  onConfirmPayment,
  confirmingPayment = false,
}: OrderCardProps) {
  const channel = getChannelMeta(order.payment_mode);
  const status = getStatusMeta(order.status);
  const ChannelIcon = channel.icon;
  const StatusIcon = status.icon;

  // Payment state is independent of fulfilment state. An order can be
  // cooking while the money has not arrived yet, and staff must be able
  // to see and settle that.
  const awaitingPayment =
    order.payment_status !== undefined && AWAITING_PAYMENT_STATES.has(order.payment_status);

  const initial = order.student_name?.trim().charAt(0).toUpperCase() || "W";

  return (
    <article className={`oc oc--${status.modifier}`}>
      {/* React 19 hoists this to <head> and dedupes by href — one sheet
          for the whole card grid, not one per card. */}
      <style href="admin-order-card" precedence="default">{ORDER_CARD_CSS}</style>

      <header className="oc-head">
        <span className="oc-id">#{order.order_id}</span>
        <span className="oc-channel">
          <ChannelIcon size={13} strokeWidth={2.25} aria-hidden="true" />
          {channel.label}
        </span>
        <span className="oc-time">
          <Clock3 size={13} strokeWidth={2} aria-hidden="true" />
          {getTimeAgo(order.created_at)}
        </span>
      </header>

      <div className="oc-customer">
        <span className="oc-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="oc-name">{order.student_name || "Walk-in customer"}</span>
      </div>

      <ul className="oc-items">
        {(order.items ?? []).map((item, index) => (
          <li key={`${order.order_id}-${index}`} className="oc-item">
            <span className="oc-item-name">{item.name}</span>
            <span className="oc-item-leader" aria-hidden="true" />
            <span className="oc-item-qty">× {item.quantity}</span>
          </li>
        ))}
        {order.total_amount != null && (
          <li className="oc-item oc-total">
            <span className="oc-item-name oc-total-label">Total</span>
            <span className="oc-item-leader" aria-hidden="true" />
            <span className="oc-total-amount">{formatAmount(order.total_amount)}</span>
          </li>
        )}
      </ul>

      <div className="oc-badges">
        <span className={`oc-badge oc-badge--${status.modifier}`}>
          <StatusIcon size={13} strokeWidth={2.25} aria-hidden="true" />
          {status.label}
        </span>
        {order.payment_status && !awaitingPayment && (
          order.payment_status === "SUCCESS" ? (
            <span className="oc-badge oc-badge--paid">
              <CircleCheck size={13} strokeWidth={2.25} aria-hidden="true" />
              Paid
            </span>
          ) : (
            <span className="oc-badge oc-badge--neutral">{titleCase(order.payment_status)}</span>
          )
        )}
        {awaitingPayment && (
          <span className="oc-badge oc-badge--due">
            <Banknote size={13} strokeWidth={2.25} aria-hidden="true" />
            Unpaid{order.total_amount != null ? ` · ${formatAmount(order.total_amount)}` : ""}
          </span>
        )}
      </div>

      <footer className="oc-actions">
        {awaitingPayment && onConfirmPayment && (
          <button
            type="button"
            className="oc-btn oc-btn--settle"
            disabled={confirmingPayment}
            aria-busy={confirmingPayment}
            onClick={() => onConfirmPayment(order.order_id)}
            title="Record that the cash/UPI payment was actually received"
          >
            {confirmingPayment ? (
              <Loader2 size={15} strokeWidth={2.25} className="oc-spin" aria-hidden="true" />
            ) : (
              <Banknote size={15} strokeWidth={2.25} aria-hidden="true" />
            )}
            {confirmingPayment ? "Confirming…" : "Confirm Payment"}
          </button>
        )}

        {order.status === "PLACED" && (
          <button
            type="button"
            className="oc-btn oc-btn--brand"
            onClick={() => onStartPreparing(order.order_id)}
          >
            <Flame size={15} strokeWidth={2.25} aria-hidden="true" />
            Start Preparing
          </button>
        )}

        {order.status === "PREPARING" && (
          <span className="oc-note oc-note--info">
            <Flame size={14} strokeWidth={2.25} aria-hidden="true" />
            Being prepared
          </span>
        )}

        {order.status === "READY" && (
          <span className="oc-note oc-note--success">
            <BellRing size={14} strokeWidth={2.25} aria-hidden="true" />
            Ready for pickup
          </span>
        )}

        <span className="oc-spacer" aria-hidden="true" />

        <button type="button" className="oc-btn oc-btn--ghost" onClick={() => onViewDetails(order)}>
          View Details
          <ChevronRight size={14} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
}

export type { OrderRecord };
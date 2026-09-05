import type { CSSProperties } from "react";
import { Smartphone, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import Modal, { modalStyles } from "../../components/Modal/Modal";
import type { OrderRecord } from "./ActiveOrdersTab";

interface OrderDetailsModalProps {
  order: OrderRecord | null;
  onClose: () => void;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
}

/* ------------------------------------------------------------------ */
/* Semantic status — same ramp as OrderCard's rail: amber → info →     */
/* success, neutral fallback. Never color alone: text carries it.      */
/* ------------------------------------------------------------------ */

const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  PLACED: { bg: "var(--bc-color-warning-bg, #fbf0da)", color: "var(--bc-color-warning-strong, #5c4610)" },
  PREPARING: { bg: "var(--bc-color-info-bg, #e7f1f6)", color: "var(--bc-color-info-strong, #25475c)" },
  READY: { bg: "var(--bc-color-success-bg, #e7f2e5)", color: "var(--bc-color-success-strong, #254c2d)" },
  DELIVERED: { bg: "var(--bc-color-success-bg, #e7f2e5)", color: "var(--bc-color-success-strong, #254c2d)" },
};
const STATUS_FALLBACK = { bg: "var(--bc-color-neutral-bg, #f4f1ea)", color: "var(--bc-color-neutral-text, #7a7266)" };

const CHANNEL_ICON: Record<string, LucideIcon> = { CASH: Store };
const ONLINE_ICON = Smartphone;

const MONO = "var(--bc-login-font-family-mono, 'JetBrains Mono', ui-monospace, monospace)";

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const BODY: CSSProperties = {
  ...modalStyles.body,
  display: "grid",
  gap: "var(--bc-space-20, 20px)",
};

/* Detail rows — a definition list with dashed separators (receipt rules) */
const DETAILS: CSSProperties = { display: "grid", margin: 0 };
const ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--bc-space-16, 16px)",
  padding: "var(--bc-space-8, 8px) 0",
  borderBottom: "1.5px dashed var(--bc-color-border-subtle, #eae1cd)",
  minWidth: 0,
};
const ROW_LAST: CSSProperties = { ...ROW, borderBottom: 0 };
const TERM: CSSProperties = {
  flex: "none",
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  color: "var(--bc-color-text-muted, #6e6455)",
};
const DETAIL: CSSProperties = {
  fontWeight: 600,
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  color: "var(--bc-color-text-primary, #2b231c)",
  textAlign: "right",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const DETAIL_MONO: CSSProperties = { ...DETAIL, fontFamily: MONO, fontVariantNumeric: "tabular-nums" };

const CHIP = (tone: { bg: string; color: string }): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 11px",
  borderRadius: "var(--bc-radius-pill, 999px)",
  backgroundColor: tone.bg,
  color: tone.color,
  fontSize: "var(--bc-font-size-caption, 0.75rem)",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

const PAY_TEXT: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontWeight: 600,
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  color: "var(--bc-color-text-primary, #2b231c)",
};

const SECTION_TITLE: CSSProperties = {
  margin: "0 0 var(--bc-space-8, 8px)",
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted, #6e6455)",
};

const TABLE_WRAP: CSSProperties = { overflowX: "auto" };
const TABLE: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const TH: CSSProperties = {
  textAlign: "right",
  padding: "var(--bc-space-8, 8px) var(--bc-space-8, 8px)",
  borderBottom: "1px solid var(--bc-color-border-subtle, #eae1cd)",
  background: "var(--bc-color-surface-page-alt, #fdf8ef)",
  color: "var(--bc-color-text-muted, #6e6455)",
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};
const TH_L: CSSProperties = { ...TH, textAlign: "left" };
const TD: CSSProperties = {
  textAlign: "right",
  padding: "var(--bc-space-8, 8px) var(--bc-space-8, 8px)",
  borderBottom: "1px solid var(--bc-color-border-subtle, #eae1cd)",
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary, #2b231c)",
  whiteSpace: "nowrap",
};
const TD_L: CSSProperties = { ...TD, textAlign: "left", fontVariantNumeric: "normal" };
const TOTAL_CELL: CSSProperties = {
  ...TD,
  fontWeight: 700,
  backgroundColor: "var(--bc-color-surface-page-alt, #fdf8ef)",
  borderBottom: 0,
};
const TOTAL_CELL_L: CSSProperties = { ...TOTAL_CELL, textAlign: "left", fontVariantNumeric: "normal" };

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

// Extracted verbatim from the showOrderModal block in AdminDashboard.jsx;
// presentation rebuilt, derivations unchanged.
export default function OrderDetailsModal({ order, onClose, formatCurrency, formatDate }: OrderDetailsModalProps) {
  if (!order) return null;

  const total = (order.items || []).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const statusTone = STATUS_TONE[order.status] ?? STATUS_FALLBACK;
  const ChannelIcon = CHANNEL_ICON[order.payment_mode] ?? ONLINE_ICON;
  // `phone` covers both registered users and walk-in guests; `guest_phone`
  // is kept only as a fallback for any stale cached data that predates it.
  const phone = order.phone || order.guest_phone;
  const rows: Array<[string, React.ReactNode, boolean?]> = [
    ["Canteen", order.canteen_name || "Canteen"],
    ["Customer", order.student_name || "Walk-in"],
    ...(order.guest_code ? ([["Guest ID", order.guest_code, true]] as Array<[string, React.ReactNode, boolean?]>) : []),
    ...(phone ? ([["Phone", phone, true]] as Array<[string, React.ReactNode, boolean?]>) : []),
  ];

  return (
    <Modal title={`Order #${order.order_id}`} onClose={onClose}>
      <div style={BODY}>
        {/* Details — definition list, receipt rules */}
        <dl style={DETAILS}>
          {rows.map(([term, value, mono]) => (
            <div key={term} style={ROW}>
              <dt style={TERM}>{term}</dt>
              <dd style={{ ...(mono ? DETAIL_MONO : DETAIL), margin: 0 }}>{value}</dd>
            </div>
          ))}

          <div style={ROW}>
            <dt style={TERM}>Status</dt>
            <dd style={{ margin: 0 }}>
              <span style={CHIP(statusTone)}>{order.status || "DELIVERED"}</span>
            </dd>
          </div>

          <div style={ROW}>
            <dt style={TERM}>Payment</dt>
            <dd style={{ margin: 0 }}>
              <span style={PAY_TEXT}>
                {order.payment_mode === "CASH" ? (
                  <Store size={15} strokeWidth={2.1} aria-hidden="true" />
                ) : (
                  <ChannelIcon size={15} strokeWidth={2.1} aria-hidden="true" />
                )}
                {order.payment_mode}
              </span>
            </dd>
          </div>

          <div style={ROW_LAST}>
            <dt style={TERM}>Time</dt>
            <dd style={DETAIL_MONO}>{formatDate(order.created_at)}</dd>
          </div>
        </dl>

        {/* Items */}
        <div>
          <h3 style={SECTION_TITLE}>Items</h3>
          <div style={TABLE_WRAP}>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH_L}>Item</th>
                  <th style={TH}>Price</th>
                  <th style={TH}>Qty</th>
                  <th style={TH}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td style={TD_L}>{item.name}</td>
                    <td style={TD}>{formatCurrency(item.price)}</td>
                    <td style={TD}>×{item.quantity}</td>
                    <td style={TD}>{formatCurrency(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={TOTAL_CELL_L} colSpan={3}>Total</td>
                  <td style={TOTAL_CELL}>{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div style={modalStyles.footer}>
        <button type="button" style={modalStyles.secondaryButton} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
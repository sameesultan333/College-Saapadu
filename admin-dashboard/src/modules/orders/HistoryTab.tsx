import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ChevronRight,
  Coins,
  IndianRupee,
  ReceiptText,
  Search,
  SearchX,
  Smartphone,
  Store,
  X,
} from "lucide-react";

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface HistoryOrder {
  order_id: number;
  status: string;
  created_at: string;
  payment_mode: string;
  items: OrderItem[];
  student_name?: string;
  guest_code?: string | null;
  phone?: string | null;
  canteen_name?: string;
}

interface HistoryTabProps {
  history: HistoryOrder[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  formatDate: (value: string) => string;
  formatCurrency: (value: number) => string;
  onViewDetails: (order: HistoryOrder) => void;
}

/* ------------------------------------------------------------------ */
/* Motion / responsive helpers — same replacements as the other tabs   */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent): void => setMatches(event.matches);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/* ------------------------------------------------------------------ */
/* Factories — standalone (a CSSProperties Record cannot hold fns)     */
/* ------------------------------------------------------------------ */

const rowStyle = (hovered: boolean): CSSProperties => ({
  backgroundColor: hovered ? "var(--bc-color-surface-page-alt)" : "transparent",
  transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
  cursor: "default",
});

const viewButtonStyle = (hovered: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  minHeight: 36,
  padding: "0 var(--bc-space-12)",
  border: `1px solid ${hovered ? "var(--bc-color-border-strong)" : "var(--bc-color-border-default)"}`,
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: hovered ? "var(--bc-color-surface-page-alt)" : "transparent",
  color: hovered ? "var(--bc-color-text-primary)" : "var(--bc-color-text-secondary)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const mobileCardStyle = (hovered: boolean): CSSProperties => ({
  ...CARD,
  display: "grid",
  gap: "var(--bc-space-12)",
  padding: "var(--bc-space-card-padding)",
  borderColor: hovered ? "var(--bc-color-border-strong)" : "var(--bc-color-border-subtle)",
  transition: "border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

/* Channel icon follows the OrderCard convention: CASH = counter,
   everything else = online. */
const channelIcon = (mode: string) => (mode === "CASH" ? Store : Smartphone);

/* ------------------------------------------------------------------ */
/* Static styles — strictly tokens that exist in the shipped theme.css */
/* ------------------------------------------------------------------ */

const ROOT: CSSProperties = { display: "grid", gap: "var(--bc-space-24)", minWidth: 0 };

const HEAD: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "var(--bc-space-16)",
  flexWrap: "wrap",
};
const EYEBROW: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-brand-accent-strong)",
};
const TITLE: CSSProperties = {
  margin: "var(--bc-space-4) 0 0",
  fontSize: "var(--bc-font-size-page-heading)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  lineHeight: "var(--bc-line-height-tight)",
  color: "var(--bc-color-text-primary)",
};
const SUBTITLE: CSSProperties = {
  margin: "var(--bc-space-4) 0 0",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-muted)",
};

const SEARCH_WRAP: CSSProperties = {
  position: "relative",
  flex: "1 1 260px",
  maxWidth: 380,
  minWidth: 220,
};
const searchInputStyle = (focused: boolean): CSSProperties => ({
  width: "100%",
  height: 44,
  padding: "0 40px 0 42px",
  border: `1px solid ${focused ? "var(--bc-color-brand-primary)" : "var(--bc-color-border-default)"}`,
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-surface-raised)",
  font: "inherit",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-primary)",
  outline: "none",
  boxShadow: focused ? "0 0 0 3px var(--bc-color-brand-primary-soft)" : "none",
  transition:
    "border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), box-shadow var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});
const SEARCH_ICON: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "var(--bc-space-16)",
  transform: "translateY(-50%)",
  color: "var(--bc-color-text-muted)",
  pointerEvents: "none",
};
const SEARCH_CLEAR: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: "var(--bc-space-8)",
  transform: "translateY(-50%)",
  display: "grid",
  placeItems: "center",
  width: 30,
  height: 30,
  border: 0,
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: "transparent",
  color: "var(--bc-color-text-muted)",
  cursor: "pointer",
};

const CARD: CSSProperties = {
  background: "var(--bc-color-surface-raised)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-lg)",
  boxShadow: "var(--bc-shadow-card)",
  minWidth: 0,
};

/* Summary strip — derived from the orders actually shown */
const STRIP: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
  gap: "var(--bc-space-card-gap)",
};
const STRIP_ITEM: CSSProperties = {
  ...CARD,
  display: "grid",
  gap: "var(--bc-space-8)",
  alignContent: "start",
  padding: "var(--bc-space-card-padding)",
};
const STRIP_TOP: CSSProperties = { display: "flex", alignItems: "center", gap: "var(--bc-space-8)", minWidth: 0 };
const STRIP_ICON: CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 30,
  height: 30,
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
};
const STRIP_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 500,
  color: "var(--bc-color-text-muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const STRIP_VALUE: CSSProperties = {
  fontSize: "var(--bc-font-size-metric)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  lineHeight: "var(--bc-line-height-tight)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/* Table */
const TABLE_WRAP: CSSProperties = {
  ...CARD,
  overflow: "auto",
};
const TABLE: CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 700 };
/* Sticky header: borderCollapse eats a stuck th's border-bottom in Chrome,
   so the separator is an inset shadow — survives the scroll. */
const TH: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  textAlign: "left",
  padding: "var(--bc-space-12) var(--bc-space-16)",
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted)",
  backgroundColor: "var(--bc-color-surface-page-alt)",
  boxShadow: "inset 0 -1px 0 var(--bc-color-border-subtle)",
  whiteSpace: "nowrap",
};
const TH_RIGHT: CSSProperties = { ...TH, textAlign: "right" };
const TD: CSSProperties = {
  padding: "var(--bc-space-12) var(--bc-space-16)",
  borderBottom: "1px solid var(--bc-color-border-subtle)",
  verticalAlign: "middle",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-primary)",
};
const TD_ID: CSSProperties = {
  ...TD,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};
const TD_DATE: CSSProperties = { ...TD, color: "var(--bc-color-text-secondary)", whiteSpace: "nowrap" };
const TD_RIGHT: CSSProperties = { ...TD, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const DATE_SUB: CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: "var(--bc-font-size-secondary)",
  color: "var(--bc-color-text-muted)",
};

const CHIP_ROW: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "var(--bc-space-4)" };
const CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 9px",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: "var(--bc-color-surface-page-alt)",
  color: "var(--bc-color-text-secondary)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 500,
  whiteSpace: "nowrap",
  maxWidth: 220,
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const CHIP_MORE: CSSProperties = {
  ...CHIP,
  border: 0,
  backgroundColor: "var(--bc-color-brand-accent-soft)",
  color: "var(--bc-color-brand-accent-strong)",
  fontWeight: 600,
};
const PAY_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 9px",
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: "var(--bc-color-neutral-bg)",
  color: "var(--bc-color-neutral-text)",
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};

/* Mobile cards */
const CARD_LIST: CSSProperties = { display: "grid", gap: "var(--bc-space-12)" };
const CARD_HEAD: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--bc-space-8)",
};
const CARD_ID: CSSProperties = {
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
};
const CARD_TOTAL_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--bc-space-12)",
  paddingTop: "var(--bc-space-12)",
  borderTop: "1px dashed var(--bc-color-border-default)",
};
const CARD_TOTAL_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  color: "var(--bc-color-text-secondary)",
};
const CARD_TOTAL_VALUE: CSSProperties = {
  fontSize: "var(--bc-font-size-section-heading)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
};
const CARD_BUTTON: CSSProperties = {
  ...viewButtonStyle(false),
  width: "100%",
  minHeight: 44,
};

/* Empty states */
const EMPTY: CSSProperties = {
  ...CARD,
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-56) var(--bc-space-24)",
  textAlign: "center",
};
const EMPTY_ICON: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 52,
  height: 52,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
};
const EMPTY_ICON_NEUTRAL: CSSProperties = {
  backgroundColor: "var(--bc-color-neutral-bg)",
  color: "var(--bc-color-neutral-text)",
};
const EMPTY_TITLE: CSSProperties = {
  margin: "var(--bc-space-4) 0 0",
  fontSize: "var(--bc-font-size-section-heading)",
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
};
const EMPTY_BODY: CSSProperties = {
  margin: 0,
  maxWidth: "40ch",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-muted)",
};
const EMPTY_BUTTON: CSSProperties = {
  marginTop: "var(--bc-space-8)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "0 var(--bc-space-20)",
  border: "1px solid transparent",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-brand-primary)",
  color: "var(--bc-color-text-inverse)",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  cursor: "pointer",
};

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export default function HistoryTab({
  history,
  searchQuery,
  onSearchChange,
  formatDate,
  formatCurrency,
  onViewDetails,
}: HistoryTabProps) {
  const isCompact = useMediaQuery("(max-width: 820px)");
  const [hoverId, setHoverId] = useState<number | "clear" | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION || !rootRef.current) return;
    const animation = rootRef.current.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  /* Totals derived once per history change — the same line-items sum the
     original computed per row, now shared by the table, cards and strip. */
  const rows = useMemo(
    () =>
      history.map((order) => ({
        order,
        total: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      })),
    [history]
  );

  const summary = useMemo(() => {
    const revenue = rows.reduce((sum, row) => sum + row.total, 0);
    return { count: rows.length, revenue, avg: rows.length > 0 ? revenue / rows.length : 0 };
  }, [rows]);

  const isFiltered = searchQuery.trim() !== "";
  const isEmpty = rows.length === 0;

  return (
    <div ref={rootRef} style={ROOT}>
      {/* Header + search */}
      <header style={HEAD}>
        <div>
          <p style={EYEBROW}>Archive</p>
          <h2 style={TITLE}>Order History</h2>
          <p style={SUBTITLE}>Every completed order, searchable and auditable</p>
        </div>

        <div style={SEARCH_WRAP}>
          <Search size={17} strokeWidth={2} style={SEARCH_ICON} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search order ID or item name"
            aria-label="Search order history"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={searchInputStyle(searchFocused)}
          />
          {isFiltered && (
            <button
              type="button"
              aria-label="Clear search"
              style={{
                ...SEARCH_CLEAR,
                ...(hoverId === "clear" ? { backgroundColor: "var(--bc-color-neutral-bg)", color: "var(--bc-color-text-primary)" } : null),
              }}
              onMouseEnter={() => setHoverId("clear")}
              onMouseLeave={() => setHoverId((current) => (current === "clear" ? null : current))}
              onClick={() => onSearchChange("")}
            >
              <X size={15} strokeWidth={2.25} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {isEmpty ? (
        /* Two distinct empties: a quiet archive vs. a search that missed */
        <div style={EMPTY}>
          <span style={{ ...EMPTY_ICON, ...(isFiltered ? EMPTY_ICON_NEUTRAL : null) }} aria-hidden="true">
            {isFiltered ? <SearchX size={22} strokeWidth={1.75} /> : <ReceiptText size={22} strokeWidth={1.75} />}
          </span>
          <h3 style={EMPTY_TITLE}>{isFiltered ? "No orders match your search" : "No completed orders yet"}</h3>
          <p style={EMPTY_BODY}>
            {isFiltered
              ? "Try a different order ID or item name, or clear the search to see the full archive."
              : "Completed orders will appear here as your kitchen serves customers."}
          </p>
          {isFiltered && (
            <button type="button" style={EMPTY_BUTTON} onClick={() => onSearchChange("")}>
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Derived summary of the orders currently shown */}
          <div style={STRIP} aria-label="Order history summary">
            <div style={STRIP_ITEM}>
              <div style={STRIP_TOP}>
                <span style={STRIP_ICON} aria-hidden="true">
                  <ReceiptText size={16} strokeWidth={2} />
                </span>
                <span style={STRIP_LABEL}>{isFiltered ? "Matching orders" : "Orders archived"}</span>
              </div>
              <span style={STRIP_VALUE}>{summary.count}</span>
            </div>

            <div style={STRIP_ITEM}>
              <div style={STRIP_TOP}>
                <span style={STRIP_ICON} aria-hidden="true">
                  <IndianRupee size={16} strokeWidth={2} />
                </span>
                <span style={STRIP_LABEL}>Combined value</span>
              </div>
              <span style={STRIP_VALUE}>{formatCurrency(summary.revenue)}</span>
            </div>

            <div style={STRIP_ITEM}>
              <div style={STRIP_TOP}>
                <span style={STRIP_ICON} aria-hidden="true">
                  <Coins size={16} strokeWidth={2} />
                </span>
                <span style={STRIP_LABEL}>Avg order value</span>
              </div>
              <span style={STRIP_VALUE}>{formatCurrency(summary.avg)}</span>
            </div>
          </div>

          {isCompact ? (
            /* ---------- Mobile: card representation, same data ---------- */
            <div style={CARD_LIST}>
              {rows.map(({ order, total }) => {
                const ChannelIcon = channelIcon(order.payment_mode);
                const hovered = hoverId === order.order_id;
                return (
                  <article
                    key={order.order_id}
                    style={mobileCardStyle(hovered)}
                    onMouseEnter={() => setHoverId(order.order_id)}
                    onMouseLeave={() => setHoverId((current) => (current === order.order_id ? null : current))}
                  >
                    <div style={CARD_HEAD}>
                      <span style={CARD_ID}>#{order.order_id}</span>
                      <span style={PAY_CHIP}>
                        <ChannelIcon size={12} strokeWidth={2.25} aria-hidden="true" />
                        {order.payment_mode}
                      </span>
                    </div>

                    <span style={{ ...TD_DATE, padding: 0, borderBottom: 0 }}>
                      {formatDate(order.created_at)}
                    </span>

                    <div style={CHIP_ROW}>
                      {order.items.slice(0, 2).map((item, idx) => (
                        <span key={`${order.order_id}-${idx}`} style={CHIP}>
                          {item.name} ×{item.quantity}
                        </span>
                      ))}
                      {order.items.length > 2 && (
                        <span style={CHIP_MORE}>+{order.items.length - 2} more</span>
                      )}
                    </div>

                    <div style={CARD_TOTAL_ROW}>
                      <span style={CARD_TOTAL_LABEL}>Total</span>
                      <span style={CARD_TOTAL_VALUE}>{formatCurrency(total)}</span>
                    </div>

                    <button
                      type="button"
                      style={{ ...CARD_BUTTON, ...(hovered ? viewButtonStyle(true) : null) }}
                      onClick={() => onViewDetails(order)}
                    >
                      View Details
                      <ChevronRight size={15} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            /* ---------- Desktop: operations table ---------- */
            <div style={TABLE_WRAP}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Order</th>
                    <th style={TH}>Date &amp; Time</th>
                    <th style={TH}>Items</th>
                    <th style={TH}>Payment</th>
                    <th style={TH_RIGHT}>Total</th>
                    <th style={TH}>
                      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ order, total }) => {
                    const ChannelIcon = channelIcon(order.payment_mode);
                    const hovered = hoverId === order.order_id;
                    return (
                      <tr
                        key={order.order_id}
                        style={rowStyle(hovered)}
                        onMouseEnter={() => setHoverId(order.order_id)}
                        onMouseLeave={() => setHoverId((current) => (current === order.order_id ? null : current))}
                      >
                        <td style={TD_ID}>#{order.order_id}</td>
                        <td style={TD_DATE}>
                          {formatDate(order.created_at)}
                          <span style={DATE_SUB}>{relativeDay(order.created_at)}</span>
                        </td>
                        <td style={TD}>
                          <div style={CHIP_ROW}>
                            {order.items.slice(0, 2).map((item, idx) => (
                              <span key={`${order.order_id}-${idx}`} style={CHIP} title={item.name}>
                                {item.name} ×{item.quantity}
                              </span>
                            ))}
                            {order.items.length > 2 && (
                              <span style={CHIP_MORE}>+{order.items.length - 2} more</span>
                            )}
                          </div>
                        </td>
                        <td style={TD}>
                          <span style={PAY_CHIP}>
                            <ChannelIcon size={12} strokeWidth={2.25} aria-hidden="true" />
                            {order.payment_mode}
                          </span>
                        </td>
                        <td style={TD_RIGHT}>{formatCurrency(total)}</td>
                        <td style={{ ...TD, textAlign: "right" }}>
                          <button
                            type="button"
                            style={viewButtonStyle(hovered)}
                            onClick={() => onViewDetails(order)}
                          >
                            View
                            <ChevronRight size={14} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Day bucket under the full timestamp — derived from created_at only. */
function relativeDay(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
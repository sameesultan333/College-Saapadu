import { useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  ChefHat,
  ClipboardList,
  Flame,
  Globe,
  LayoutGrid,
  Search,
  SearchX,
  Store,
  X,
} from "lucide-react";
import OrderCard from "./OrderCard";

/* ------------------------------------------------------------------ */
/* Contract — identical to the parent (AdminDashboard)                 */
/* ------------------------------------------------------------------ */

interface OrderItem {
  id?: number;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderRecord {
  order_id: number;
  status: string;
  payment_mode: string;
  payment_status?: string;
  total_amount?: number | null;
  student_name?: string;
  guest_code?: string | null;
  guest_phone?: string | null;
  /** Customer's phone -- registered user or walk-in guest, whichever
   *  applies. Prefer this over guest_phone (guest-only, kept for
   *  back-compat) when displaying a contact number. */
  phone?: string | null;
  canteen_name?: string;
  created_at: string;
  items: OrderItem[];
}

interface ActiveOrdersTabProps {
  orders: OrderRecord[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterType: string;
  onFilterTypeChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  getTimeAgo: (timestamp: string) => string;
  onStartPreparing: (orderId: number) => void;
  onViewDetails: (order: OrderRecord) => void;
  onConfirmPayment?: (orderId: number) => void;
  confirmingPaymentId?: number | null;
}

/* ------------------------------------------------------------------ */
/* Filters — values match the parent's filtering logic                 */
/* ------------------------------------------------------------------ */

interface SegmentOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

const TYPE_OPTIONS: SegmentOption[] = [
  { value: "ALL", label: "All", icon: LayoutGrid },
  { value: "COUNTER", label: "Counter", icon: Store },
  { value: "ONLINE", label: "Online", icon: Globe },
];

const STATUS_OPTIONS: SegmentOption[] = [
  { value: "ALL", label: "All", icon: LayoutGrid },
  { value: "PLACED", label: "Placed", icon: ClipboardList },
  { value: "PREPARING", label: "Preparing", icon: Flame },
  { value: "READY", label: "Ready", icon: BellRing },
];

const orderNoun = (count: number): string => (count === 1 ? "order" : "orders");

/* ------------------------------------------------------------------ */
/* Subcomponents (module-level — not recreated on render)              */
/* ------------------------------------------------------------------ */

function OrdersHeader({ hasOrders }: { hasOrders: boolean }) {
  return (
    <header className="ao-head">
      <p className="ao-eyebrow">
        <span className={`ao-dot${hasOrders ? "" : " ao-dot--idle"}`} aria-hidden="true" />
        Live queue
      </p>
      <h2 className="ao-title">Active Orders</h2>
      <p className="ao-subtitle">Counter and online orders currently in the kitchen queue.</p>
    </header>
  );
}

interface SegmentGroupProps {
  label: string;
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
}

function SegmentGroup({ label, options, value, onChange }: SegmentGroupProps) {
  return (
    <div className="ao-seg" role="group" aria-label={label}>
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
        <button
          key={optionValue}
          type="button"
          className="ao-seg-btn"
          aria-pressed={optionValue === value}
          onClick={() => onChange(optionValue)}
        >
          <Icon className="ao-seg-icon" size={15} strokeWidth={2} aria-hidden="true" />
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

interface OrdersMetaProps {
  count: number;
  isFiltered: boolean;
  onClear: () => void;
}

function OrdersMeta({ count, isFiltered, onClear }: OrdersMetaProps) {
  return (
    <p className="ao-meta" aria-live="polite">
      <span className="ao-meta-count">{count}</span>
      <span>{isFiltered ? `${orderNoun(count)} match your filters` : `${orderNoun(count)} in queue`}</span>
      {isFiltered && (
        <button type="button" className="ao-meta-clear" onClick={onClear}>
          <X size={14} strokeWidth={2.25} aria-hidden="true" />
          Clear filters
        </button>
      )}
    </p>
  );
}

type EmptyVariant = "all-clear" | "no-match";

const EMPTY_COPY: Record<EmptyVariant, { eyebrow: string; title: string; description: string }> = {
  "all-clear": {
    eyebrow: "All clear",
    title: "The kitchen is caught up",
    description: "New orders will appear here the moment they come in.",
  },
  "no-match": {
    eyebrow: "No results",
    title: "No orders match your filters",
    description: "Try a different search term, or clear the filters to see the full queue.",
  },
};

interface OrdersEmptyStateProps {
  variant: EmptyVariant;
  onClear?: () => void;
}

function OrdersEmptyState({ variant, onClear }: OrdersEmptyStateProps) {
  const copy = EMPTY_COPY[variant];
  const Icon = variant === "all-clear" ? ChefHat : SearchX;
  return (
    <section className="ao-empty">
      <span
        className={`ao-empty-icon${variant === "no-match" ? " ao-empty-icon--neutral" : ""}`}
        aria-hidden="true"
      >
        <Icon size={24} strokeWidth={1.75} />
      </span>
      <p className="ao-empty-eyebrow">{copy.eyebrow}</p>
      <h3 className="ao-empty-title">{copy.title}</h3>
      <p className="ao-empty-description">{copy.description}</p>
      {variant === "no-match" && onClear && (
        <button type="button" className="ao-btn" onClick={onClear}>
          Clear filters
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export default function ActiveOrdersTab({
  orders,
  searchQuery,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  filterStatus,
  onFilterStatusChange,
  getTimeAgo,
  onStartPreparing,
  onViewDetails,
  onConfirmPayment,
  confirmingPaymentId = null,
}: ActiveOrdersTabProps) {
  const isFiltered = searchQuery.trim() !== "" || filterType !== "ALL" || filterStatus !== "ALL";

  const handleClearFilters = useCallback(() => {
    onSearchChange("");
    onFilterTypeChange("ALL");
    onFilterStatusChange("ALL");
  }, [onSearchChange, onFilterTypeChange, onFilterStatusChange]);

  return (
    <div className="ao-root">
      <style>{ACTIVE_ORDERS_CSS}</style>

      <OrdersHeader hasOrders={orders.length > 0} />

      <div className="ao-toolbar">
        <div className="ao-search">
          <Search className="ao-search-icon" size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            className="ao-input"
            placeholder="Search by order ID, customer or item"
            aria-label="Search active orders"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery !== "" && (
            <button
              type="button"
              className="ao-search-clear"
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
            >
              <X size={15} strokeWidth={2.25} aria-hidden="true" />
            </button>
          )}
        </div>

        <SegmentGroup
          label="Filter by order type"
          options={TYPE_OPTIONS}
          value={filterType}
          onChange={onFilterTypeChange}
        />
        <SegmentGroup
          label="Filter by status"
          options={STATUS_OPTIONS}
          value={filterStatus}
          onChange={onFilterStatusChange}
        />
      </div>

      <section className="ao-results" aria-label="Order results">
        {orders.length === 0 ? (
          <OrdersEmptyState
            variant={isFiltered ? "no-match" : "all-clear"}
            onClear={isFiltered ? handleClearFilters : undefined}
          />
        ) : (
          <>
            <OrdersMeta count={orders.length} isFiltered={isFiltered} onClear={handleClearFilters} />
            <div className="ao-grid">
              {orders.map((order) => (
                <OrderCard
                  key={order.order_id}
                  order={order}
                  getTimeAgo={getTimeAgo}
                  onStartPreparing={onStartPreparing}
                  onViewDetails={onViewDetails}
                  onConfirmPayment={onConfirmPayment}
                  confirmingPayment={confirmingPaymentId === order.order_id}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stylesheet — injected once per mount, namespaced "ao-".             */
/* Consumes theme.css custom properties only; no raw design values.    */
/* ------------------------------------------------------------------ */

const ACTIVE_ORDERS_CSS = `
.ao-root { display: grid; gap: var(--space-5); }

/* Header ---------------------------------------------------------- */
.ao-eyebrow {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: var(--text-xs); font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--brass-600);
}
.ao-title {
  margin-top: var(--space-2);
  font-size: clamp(1.5rem, 1.3rem + 0.7vw, 1.75rem);
  font-weight: 700; letter-spacing: -0.02em; color: var(--ink);
}
.ao-subtitle { margin-top: var(--space-1); font-size: var(--text-md); color: var(--ink-2); }

.ao-dot { position: relative; flex: none; width: 7px; height: 7px; border-radius: var(--radius-full); background: var(--success-600); }
.ao-dot::after {
  content: ""; position: absolute; inset: 0; border-radius: var(--radius-full);
  background: var(--success-600);
  animation: ao-pulse 2.2s var(--ease-out) infinite;
}
.ao-dot--idle { background: var(--sage-500); }
.ao-dot--idle::after { animation: none; opacity: 0; }
@keyframes ao-pulse {
  0% { opacity: 0.5; transform: scale(1); }
  70%, 100% { opacity: 0; transform: scale(2.8); }
}

/* Toolbar ----------------------------------------------------------- */
.ao-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }

.ao-search { position: relative; flex: 1 1 260px; min-width: 220px; }
.ao-search-icon {
  position: absolute; top: 50%; left: var(--space-4); transform: translateY(-50%);
  color: var(--ink-3); pointer-events: none;
  transition: color var(--transition-fast) var(--ease-out);
}
.ao-search:focus-within .ao-search-icon { color: var(--green-700); }

.ao-input {
  width: 100%; height: 44px; padding: 0 40px 0 42px;
  border: 1px solid var(--border-strong); border-radius: var(--radius-md);
  background: var(--paper); font: inherit; font-size: var(--text-base); color: var(--ink);
  transition: border-color var(--transition-base) var(--ease-out),
    box-shadow var(--transition-base) var(--ease-out);
}
.ao-input::placeholder { color: var(--ink-3); }
.ao-input:focus { outline: none; border-color: var(--green-600); box-shadow: 0 0 0 3px rgba(46, 107, 65, 0.14); }
.ao-input::-webkit-search-cancel-button,
.ao-input::-webkit-search-decoration { -webkit-appearance: none; appearance: none; }

.ao-search-clear {
  position: absolute; top: 50%; right: var(--space-2); transform: translateY(-50%);
  display: grid; place-items: center; width: 28px; height: 28px;
  border-radius: var(--radius-sm); color: var(--ink-3);
  transition: background-color var(--transition-fast) var(--ease-out),
    color var(--transition-fast) var(--ease-out);
}
.ao-search-clear:hover { background: var(--cream); color: var(--ink); }

/* Segmented filters -------------------------------------------------- */
.ao-seg {
  display: inline-flex; align-items: center; gap: 2px; padding: 3px;
  background: var(--cream); border: 1px solid var(--border); border-radius: var(--radius-md);
}
.ao-seg-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 38px; padding: 0 13px; border-radius: var(--radius-sm);
  font-size: var(--text-sm); font-weight: 600; color: var(--ink-2); white-space: nowrap;
  transition: background-color var(--transition-fast) var(--ease-out),
    color var(--transition-fast) var(--ease-out),
    box-shadow var(--transition-fast) var(--ease-out);
}
.ao-seg-btn:hover { color: var(--ink); }
.ao-seg-btn[aria-pressed="true"] { background: var(--green-700); color: #fff; box-shadow: var(--shadow-sm); }
.ao-seg-btn:focus-visible { outline: 2px solid var(--green-600); outline-offset: 1px; }
.ao-seg-icon { flex: none; }

/* Results ------------------------------------------------------------ */
.ao-results { display: grid; gap: var(--space-3); }

.ao-meta {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: var(--space-1) var(--space-2);
  font-size: var(--text-sm); color: var(--ink-3);
}
.ao-meta-count { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ink); }
.ao-meta-clear {
  display: inline-flex; align-items: center; gap: var(--space-1);
  margin-left: var(--space-1); padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 600;
  color: var(--green-700);
  transition: background-color var(--transition-fast) var(--ease-out),
    color var(--transition-fast) var(--ease-out);
}
.ao-meta-clear:hover { background: var(--green-50); color: var(--green-800); }

.ao-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 310px), 1fr)); gap: var(--space-4); }
.ao-grid > * { min-width: 0; }

/* Empty states -------------------------------------------------------- */
.ao-empty {
  display: flex; flex-direction: column; align-items: center;
  padding: clamp(3rem, 7vw, 5rem) var(--space-6);
  background: var(--paper); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); text-align: center;
}
.ao-empty-icon {
  display: grid; place-items: center; width: 56px; height: 56px;
  margin-bottom: var(--space-4);
  border: 1px solid var(--green-100); border-radius: var(--radius-full);
  background: var(--green-50); color: var(--green-700);
}
.ao-empty-icon--neutral { background: var(--cream); border-color: var(--border); color: var(--ink-3); }
.ao-empty-eyebrow {
  font-size: var(--text-xs); font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--brass-600);
}
.ao-empty-title { margin-top: var(--space-2); font-size: var(--text-xl); font-weight: 600; color: var(--ink); }
.ao-empty-description { max-width: 38ch; margin-top: var(--space-1); font-size: var(--text-base); color: var(--ink-3); }

.ao-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 40px; margin-top: var(--space-5); padding: 0 var(--space-4);
  border: 1px solid var(--border-strong); border-radius: var(--radius-md);
  background: var(--paper); font-size: var(--text-sm); font-weight: 600; color: var(--ink-2);
  transition: background-color var(--transition-base) var(--ease-out),
    color var(--transition-base) var(--ease-out),
    border-color var(--transition-base) var(--ease-out);
}
.ao-btn:hover { background: var(--ivory); border-color: var(--ink-3); color: var(--ink); }

/* Adaptive ------------------------------------------------------------ */
@media (max-width: 700px) {
  .ao-search { flex-basis: 100%; min-width: 0; }
  .ao-seg { display: flex; width: 100%; }
  .ao-seg-btn { flex: 1; height: 42px; padding: 0 var(--space-2); }
  .ao-empty { padding: var(--space-7) var(--space-5); }
}
@media (max-width: 380px) {
  .ao-seg-icon { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .ao-dot::after { animation: none; opacity: 0; }
}

/* Required theme.css tokens:
   --paper --cream --ivory --border --border-strong
   --ink --ink-2 --ink-3 --green-50 --green-100 --green-600 --green-700 --green-800
   --sage-500 --success-600 --brass-600
   --radius-sm --radius-md --radius-lg --radius-full --shadow-sm
   --text-xs --text-sm --text-base --text-md --text-xl
   --space-1..7 --transition-fast --transition-base --ease-out
*/
`;
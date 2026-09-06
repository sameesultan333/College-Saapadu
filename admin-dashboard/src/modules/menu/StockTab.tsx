import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  Boxes,
  CircleAlert,
  IndianRupee,
  LayoutGrid,
  PackageOpen,
  PackageSearch,
  PackageX,
  Plus,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import StockCard from "./StockCard";

interface StockItem {
  id: number;
  name: string;
  price: number;
  stock: number;
  is_veg: boolean;
}

interface StockTabProps {
  menu: StockItem[];
  formatCurrency: (value: number) => string;
  onStockUpdate: (id: number, stock: string) => void;
  onAddNewItem?: (() => void) | null;
  onDeleteItem?: (item: StockItem) => void;
  canAddItem?: boolean;
}

/* ------------------------------------------------------------------ */
/* Severity model — identical thresholds to StockCard, so the KPI      */
/* strip, the filter and the cards always agree.                       */
/* ------------------------------------------------------------------ */

type StockFilter = "ALL" | "CRITICAL" | "WATCH";

const matchesFilter = (stock: number, filter: StockFilter): boolean => {
  if (filter === "ALL") return true;
  if (filter === "CRITICAL") return stock < 5;
  return stock >= 5 && stock < 10;
};

interface SegmentMeta {
  value: StockFilter;
  label: string;
  icon: LucideIcon;
}

const SEGMENTS: SegmentMeta[] = [
  { value: "ALL", label: "All", icon: LayoutGrid },
  { value: "CRITICAL", label: "Critical", icon: CircleAlert },
  { value: "WATCH", label: "Watch", icon: TrendingDown },
];

/* ------------------------------------------------------------------ */
/* Styles — static, module-scope, token-only                           */
/* ------------------------------------------------------------------ */

const styles = {
  root: { display: "grid", gap: "var(--bc-space-24)", minWidth: 0 } as CSSProperties,

  head: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "var(--bc-space-16)",
    flexWrap: "wrap",
  } as CSSProperties,

  eyebrow: {
    margin: 0,
    fontSize: "var(--bc-font-size-eyebrow)",
    fontWeight: 600,
    letterSpacing: "var(--bc-letter-spacing-eyebrow)",
    textTransform: "uppercase",
    color: "var(--bc-color-brand-accent-strong)",
  } as CSSProperties,

  title: {
    margin: "var(--bc-space-4) 0 0",
    fontSize: "var(--bc-font-size-page-heading)",
    fontWeight: 700,
    letterSpacing: "var(--bc-letter-spacing-tight)",
    lineHeight: "var(--bc-line-height-tight)",
    color: "var(--bc-color-text-primary)",
  } as CSSProperties,

  subtitle: {
    margin: "var(--bc-space-4) 0 0",
    fontSize: "var(--bc-font-size-body)",
    color: "var(--bc-color-text-muted)",
  } as CSSProperties,

  addButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--bc-space-8)",
    minHeight: 42,
    padding: "0 var(--bc-space-20)",
    border: "1px solid transparent",
    borderRadius: "var(--bc-radius-md)",
    backgroundColor: "var(--bc-color-brand-primary)",
    color: "var(--bc-color-text-inverse)",
    fontSize: "var(--bc-font-size-body)",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition:
      "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), transform var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
  } as CSSProperties,

  addButtonDisabled: { opacity: 0.5, cursor: "not-allowed" } as CSSProperties,

  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
    gap: "var(--bc-space-card-gap)",
  } as CSSProperties,

  kpi: {
    display: "grid",
    gap: "var(--bc-space-8)",
    alignContent: "start",
    padding: "var(--bc-space-card-padding)",
    border: "1px solid var(--bc-color-border-subtle)",
    borderRadius: "var(--bc-radius-lg)",
    backgroundColor: "var(--bc-color-surface-raised)",
    boxShadow: "var(--bc-shadow-card)",
    minWidth: 0,
  } as CSSProperties,

  kpiAlert: {
    borderColor: "var(--bc-color-danger-border)",
    backgroundColor: "var(--bc-color-danger-bg)",
  } as CSSProperties,

  kpiTop: { display: "flex", alignItems: "center", gap: "var(--bc-space-8)", minWidth: 0 } as CSSProperties,

  kpiIcon: {
    display: "grid",
    placeItems: "center",
    flex: "none",
    width: 30,
    height: 30,
    borderRadius: "var(--bc-radius-sm)",
    backgroundColor: "var(--bc-color-brand-primary-faint)",
    color: "var(--bc-color-brand-primary)",
  } as CSSProperties,

  kpiIconDanger: {
    backgroundColor: "var(--bc-color-danger-bg)",
    color: "var(--bc-color-danger)",
  } as CSSProperties,

  kpiLabel: {
    fontSize: "var(--bc-font-size-secondary)",
    fontWeight: 500,
    color: "var(--bc-color-text-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as CSSProperties,

  kpiValue: {
    fontSize: "var(--bc-font-size-metric)",
    fontWeight: 700,
    letterSpacing: "var(--bc-letter-spacing-tighter)",
    lineHeight: "var(--bc-line-height-tight)",
    fontVariantNumeric: "tabular-nums",
    color: "var(--bc-color-text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as CSSProperties,

  filterRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--bc-space-12)",
    flexWrap: "wrap",
  } as CSSProperties,

  filterLabel: {
    fontSize: "var(--bc-font-size-secondary)",
    fontWeight: 600,
    color: "var(--bc-color-text-muted)",
  } as CSSProperties,

  seg: {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    padding: 3,
    border: "1px solid var(--bc-color-border-subtle)",
    borderRadius: "var(--bc-radius-md)",
    backgroundColor: "var(--bc-color-surface-sunken)",
  } as CSSProperties,

  segBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    padding: "0 var(--bc-space-12)",
    border: 0,
    borderRadius: "var(--bc-radius-sm)",
    backgroundColor: "transparent",
    color: "var(--bc-color-text-secondary)",
    fontSize: "var(--bc-font-size-secondary)",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition:
      "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
  } as CSSProperties,

  segBtnActive: {
    backgroundColor: "var(--bc-color-brand-primary)",
    color: "var(--bc-color-text-inverse)",
    boxShadow: "var(--bc-shadow-subtle)",
  } as CSSProperties,

  segCount: {
    padding: "1px 7px",
    borderRadius: "var(--bc-radius-pill)",
    backgroundColor: "var(--bc-color-white-alpha-25)",
    fontSize: "var(--bc-font-size-eyebrow)",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  } as CSSProperties,

  meta: {
    display: "flex",
    alignItems: "center",
    gap: "var(--bc-space-8)",
    marginLeft: "auto",
    fontSize: "var(--bc-font-size-secondary)",
    color: "var(--bc-color-text-muted)",
  } as CSSProperties,

  metaClear: {
    border: 0,
    padding: "var(--bc-space-4) var(--bc-space-8)",
    borderRadius: "var(--bc-radius-sm)",
    backgroundColor: "transparent",
    color: "var(--bc-color-brand-primary)",
    fontSize: "var(--bc-font-size-secondary)",
    fontWeight: 600,
    cursor: "pointer",
  } as CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
    gap: "var(--bc-space-card-gap)",
    alignItems: "start",
    minWidth: 0,
  } as CSSProperties,

  gridCell: { minWidth: 0, animation: "stk-rise var(--bc-motion-duration-normal) var(--bc-motion-easing-enter) both" } as CSSProperties,

  empty: {
    display: "grid",
    justifyItems: "center",
    gap: "var(--bc-space-8)",
    padding: "var(--bc-space-56) var(--bc-space-24)",
    border: "1px dashed var(--bc-color-border-default)",
    borderRadius: "var(--bc-radius-lg)",
    backgroundColor: "var(--bc-color-surface-page-alt)",
    textAlign: "center",
  } as CSSProperties,

  emptyIcon: {
    display: "grid",
    placeItems: "center",
    width: 52,
    height: 52,
    borderRadius: "var(--bc-radius-round)",
    backgroundColor: "var(--bc-color-brand-primary-faint)",
    color: "var(--bc-color-brand-primary)",
  } as CSSProperties,

  emptyTitle: {
    margin: "var(--bc-space-4) 0 0",
    fontSize: "var(--bc-font-size-section-heading)",
    fontWeight: 600,
    color: "var(--bc-color-text-primary)",
  } as CSSProperties,

  emptyBody: {
    margin: 0,
    maxWidth: "40ch",
    fontSize: "var(--bc-font-size-body)",
    color: "var(--bc-color-text-muted)",
  } as CSSProperties,

  emptyBtn: {
    marginTop: "var(--bc-space-8)",
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--bc-space-8)",
    minHeight: 42,
    padding: "0 var(--bc-space-20)",
    border: "1px solid transparent",
    borderRadius: "var(--bc-radius-md)",
    backgroundColor: "var(--bc-color-brand-primary)",
    color: "var(--bc-color-text-inverse)",
    fontSize: "var(--bc-font-size-body)",
    fontWeight: 600,
    cursor: "pointer",
  } as CSSProperties,
};

/* ------------------------------------------------------------------ */
/* Subcomponents                                                       */
/* ------------------------------------------------------------------ */

interface KpiProps {
  icon: LucideIcon;
  label: string;
  value: string;
  alert?: boolean;
}

function Kpi({ icon: Icon, label, value, alert = false }: KpiProps) {
  return (
    <div style={alert ? { ...styles.kpi, ...styles.kpiAlert } : styles.kpi}>
      <div style={styles.kpiTop}>
        <span style={alert ? { ...styles.kpiIcon, ...styles.kpiIconDanger } : styles.kpiIcon} aria-hidden="true">
          <Icon size={16} strokeWidth={2} />
        </span>
        <span style={styles.kpiLabel}>{label}</span>
      </div>
      <span style={styles.kpiValue}>{value}</span>
    </div>
  );
}

interface FilterBarProps {
  menu: StockItem[];
  filter: StockFilter;
  shownCount: number;
  onChange: (filter: StockFilter) => void;
}

function FilterBar({ menu, filter, shownCount, onChange }: FilterBarProps) {
  const counts = useMemo(
    () => ({
      ALL: menu.length,
      CRITICAL: menu.filter((i) => i.stock < 5).length,
      WATCH: menu.filter((i) => i.stock >= 5 && i.stock < 10).length,
    }),
    [menu]
  );

  return (
    <div className="stock-filter" style={styles.filterRow}>
      <span style={styles.filterLabel}>Show</span>
      <div className="stock-segments" style={styles.seg} role="group" aria-label="Filter menu items by stock level">
        {SEGMENTS.map(({ value, label, icon: Icon }) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              className="stock-segment-button"
              style={active ? { ...styles.segBtn, ...styles.segBtnActive } : styles.segBtn}
              aria-pressed={active}
              onClick={() => onChange(value)}
            >
              <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
              {label}
              <span style={styles.segCount}>{counts[value]}</span>
            </button>
          );
        })}
      </div>
      {filter !== "ALL" && (
        <span style={styles.meta} aria-live="polite">
          {shownCount} shown
          <button type="button" style={styles.metaClear} onClick={() => onChange("ALL")}>
            Reset
          </button>
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export default function StockTab({
  menu,
  formatCurrency,
  onStockUpdate,
  onAddNewItem = null,
  onDeleteItem,
  canAddItem = true,
}: StockTabProps) {
  const [filter, setFilter] = useState<StockFilter>("ALL");

  const outOfStock = menu.filter((i) => i.stock === 0).length;
  const inventoryValue = useMemo(
    () => menu.reduce((sum, item) => sum + item.price * item.stock, 0),
    [menu]
  );
  const visibleItems = useMemo(() => menu.filter((i) => matchesFilter(i.stock, filter)), [menu, filter]);

  return (
    <div style={styles.root}>
      <style href="stk-stock-tab" precedence="default">{STOCK_TAB_CSS}</style>

      {/* Header */}
      <header style={styles.head}>
        <div>
          <p style={styles.eyebrow}>Inventory</p>
          <h2 style={styles.title}>Stock Management</h2>
          <p style={styles.subtitle}>Update availability as stock arrives and sells out.</p>
        </div>
        {canAddItem && (
          <button
            type="button"
            style={onAddNewItem ? styles.addButton : { ...styles.addButton, ...styles.addButtonDisabled }}
            disabled={!onAddNewItem}
            onClick={onAddNewItem ?? undefined}
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
            Add New Item
          </button>
        )}
      </header>

      {/* Derived KPI strip */}
      <div className="stock-kpis" style={styles.kpis}>
        <Kpi icon={Boxes} label="Menu items" value={String(menu.length)} />
        <Kpi
          icon={PackageX}
          label={outOfStock === 1 ? "Item out of stock" : "Items out of stock"}
          value={String(outOfStock)}
          alert={outOfStock > 0}
        />
        <Kpi icon={IndianRupee} label="Stock value on hand" value={formatCurrency(inventoryValue)} />
      </div>

      {/* Severity filter */}
      <FilterBar menu={menu} filter={filter} shownCount={visibleItems.length} onChange={setFilter} />

      {/* Cards / empty states */}
      {menu.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon} aria-hidden="true">
            <PackageOpen size={22} strokeWidth={1.75} />
          </span>
          <h3 style={styles.emptyTitle}>No menu items yet</h3>
          <p style={styles.emptyBody}>
            Add your first item to start tracking availability. It will appear here and on the counter immediately.
          </p>
          {canAddItem && onAddNewItem && (
            <button type="button" style={styles.emptyBtn} onClick={onAddNewItem}>
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              Add New Item
            </button>
          )}
        </div>
      ) : visibleItems.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon} aria-hidden="true">
            <PackageSearch size={22} strokeWidth={1.75} />
          </span>
          <h3 style={styles.emptyTitle}>Nothing in this range</h3>
          <p style={styles.emptyBody}>No items match the selected stock level. Reset the filter to see the full menu.</p>
          <button type="button" style={styles.emptyBtn} onClick={() => setFilter("ALL")}>
            Reset filter
          </button>
        </div>
      ) : (
        <div className="stock-grid" style={styles.grid}>
          {visibleItems.map((item, index) => (
            <div
              key={item.id}
              style={{ ...styles.gridCell, animationDelay: `${Math.min(index * 30, 240)}ms` }}
            >
              <StockCard
                item={item}
                formatCurrency={formatCurrency}
                onStockUpdate={onStockUpdate}
                onDelete={onDeleteItem}
                canDelete={canAddItem && !!onDeleteItem}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stylesheet — entrance motion only; hover elevation stays in         */
/* StockCard/.stock-card (theme.css). Reduced-motion is killed by the  */
/* theme's global prefers-reduced-motion rule.                         */
/* ------------------------------------------------------------------ */

const STOCK_TAB_CSS = `
@keyframes stk-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.stk button:not(:disabled):hover{filter:brightness(0.96)}
.stk button:not(:disabled):active{transform:translateY(1px)}
`;

/* (hover refinement is attached to the root via the .stk class below) */
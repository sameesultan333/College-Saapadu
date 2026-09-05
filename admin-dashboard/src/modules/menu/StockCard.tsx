import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";
import { Minus, Plus, Trash2, TriangleAlert } from "lucide-react";

interface StockCardItem {
  id: number;
  name: string;
  price: number;
  stock: number;
  is_veg: boolean;
}

interface StockCardProps {
  item: StockCardItem;
  formatCurrency: (value: number) => string;
  onStockUpdate: (id: number, stock: string) => void;
  onDelete?: (item: StockCardItem) => void;
  canDelete?: boolean;
}

/* ------------------------------------------------------------------ */
/* Severity — derived from the COMMITTED stock (item.stock), never the */
/* in-flight edit. Thresholds: 0 / <5 / <10. The <5 banner threshold   */
/* matches the original component exactly.                             */
/* ------------------------------------------------------------------ */

type Severity = "out" | "critical" | "low" | "ok";

const SEVERITY_META: Record<Severity, { label: string; accent: string; chipBg: string; chipColor: string }> = {
  out: {
    label: "Out of stock",
    accent: "var(--bc-color-danger)",
    chipBg: "var(--bc-color-danger-bg)",
    chipColor: "var(--bc-color-danger)",
  },
  critical: {
    label: "Low stock",
    accent: "var(--bc-color-warning)",
    chipBg: "var(--bc-color-warning-bg)",
    chipColor: "var(--bc-color-warning)",
  },
  low: {
    label: "Running low",
    accent: "var(--bc-color-brand-accent)",
    chipBg: "var(--bc-color-brand-accent-soft)",
    chipColor: "var(--bc-color-brand-accent-strong)",
  },
  ok: {
    label: "In stock",
    accent: "var(--bc-color-success-border)",
    chipBg: "var(--bc-color-success-bg)",
    chipColor: "var(--bc-color-success)",
  },
};

const getSeverity = (stock: number): Severity =>
  stock <= 0 ? "out" : stock < 5 ? "critical" : stock < 10 ? "low" : "ok";

/* ------------------------------------------------------------------ */
/* Styles — static, module-scope, token-only                           */
/* ------------------------------------------------------------------ */

const styles = {
  card: {
    position: "relative",
    background: "var(--bc-color-surface-raised)",
    border: "1px solid var(--bc-color-border-subtle)",
    borderTopWidth: 3,
    borderRadius: "var(--bc-radius-lg)",
    boxShadow: "var(--bc-shadow-card)",
    padding: "var(--bc-space-card-padding)",
    display: "grid",
    gap: "var(--bc-space-12)",
    minWidth: 0,
  } as CSSProperties,

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "var(--bc-space-8)",
    minWidth: 0,
  } as CSSProperties,

  idBlock: { minWidth: 0 } as CSSProperties,

  nameRow: { display: "flex", alignItems: "center", gap: "var(--bc-space-8)", minWidth: 0 } as CSSProperties,

  name: {
    margin: 0,
    fontSize: "var(--bc-font-size-body)",
    fontWeight: 600,
    letterSpacing: "var(--bc-letter-spacing-tight)",
    color: "var(--bc-color-text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as CSSProperties,

  price: {
    marginTop: 3,
    fontSize: "var(--bc-font-size-secondary)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: "var(--bc-color-text-secondary)",
  } as CSSProperties,

  /* FSSAI-style classification mark: bordered square, filled dot. */
  vegMark: (isVeg: boolean): CSSProperties => ({
    display: "inline-grid",
    placeItems: "center",
    flex: "none",
    width: 15,
    height: 15,
    border: `1.5px solid ${isVeg ? "var(--bc-color-success)" : "var(--bc-color-danger)"}`,
    borderRadius: 3,
    backgroundColor: "var(--bc-color-surface-raised)",
  }),
  vegDot: (isVeg: boolean): CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: "var(--bc-radius-round)",
    backgroundColor: isVeg ? "var(--bc-color-success)" : "var(--bc-color-danger)",
  }),

  deleteButton: {
    display: "grid",
    placeItems: "center",
    flex: "none",
    width: 40,
    height: 40,
    padding: 0,
    border: "1px solid var(--bc-color-danger-border)",
    borderRadius: "var(--bc-radius-md)",
    backgroundColor: "transparent",
    color: "var(--bc-color-danger)",
    cursor: "pointer",
    transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
  } as CSSProperties,

  fieldLabel: {
    marginBottom: "var(--bc-space-4)",
    fontSize: "var(--bc-font-size-eyebrow)",
    fontWeight: 600,
    letterSpacing: "var(--bc-letter-spacing-eyebrow)",
    textTransform: "uppercase",
    color: "var(--bc-color-text-muted)",
  } as CSSProperties,

  stockRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--bc-space-12)",
    flexWrap: "wrap",
  } as CSSProperties,

  stepper: {
    display: "inline-flex",
    alignItems: "stretch",
    border: "1px solid var(--bc-color-border-default)",
    borderRadius: "var(--bc-radius-md)",
    backgroundColor: "var(--bc-color-surface-raised)",
    overflow: "hidden",
  } as CSSProperties,

  stepButton: {
    display: "grid",
    placeItems: "center",
    width: 44,
    height: 44,
    padding: 0,
    border: 0,
    backgroundColor: "transparent",
    color: "var(--bc-color-text-secondary)",
    cursor: "pointer",
    transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
  } as CSSProperties,

  stepButtonDisabled: { opacity: 0.4, cursor: "not-allowed" } as CSSProperties,

  stockInput: (focused: boolean): CSSProperties => ({
    width: 64,
    height: 44,
    padding: 0,
    border: 0,
    outline: "none",
    textAlign: "center",
    fontSize: "var(--bc-font-size-md, 0.9375rem)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: "var(--bc-color-text-primary)",
    backgroundColor: focused ? "var(--bc-color-surface-page-alt)" : "transparent",
    boxShadow: focused ? "inset 0 0 0 2px var(--bc-color-brand-primary)" : "none",
    transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), box-shadow var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
  }),

  chip: (severity: Severity): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
    padding: "5px 11px",
    borderRadius: "var(--bc-radius-pill)",
    backgroundColor: SEVERITY_META[severity].chipBg,
    color: SEVERITY_META[severity].chipColor,
    fontSize: "var(--bc-font-size-secondary)",
    fontWeight: 600,
    whiteSpace: "nowrap",
  }),
  chipDot: (severity: Severity): CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: "var(--bc-radius-round)",
    backgroundColor: "currentColor",
    opacity: 0.85,
  }),

  alert: (severity: Severity): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "var(--bc-space-8)",
    minWidth: 0,
    overflowWrap: "anywhere",
    padding: "9px var(--bc-space-12)",
    borderRadius: "var(--bc-radius-md)",
    backgroundColor: SEVERITY_META[severity].chipBg,
    color: SEVERITY_META[severity].chipColor,
    fontSize: "var(--bc-font-size-secondary)",
    fontWeight: 600,
  }),
};

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export default function StockCard({
  item,
  formatCurrency,
  onStockUpdate,
  onDelete,
  canDelete = false,
}: StockCardProps) {
  const [val, setVal] = useState(String(item.stock));
  const [focused, setFocused] = useState(false);
  const isEditing = useRef(false);

  useEffect(() => {
    if (!isEditing.current) {
      setVal(String(item.stock));
    }
  }, [item.stock]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Digits only — stock counts can't be negative, fractional or textual.
    // Clearing the field still yields "" and fires, matching the original.
    const newVal = e.target.value.replace(/[^0-9]/g, "");
    setVal(newVal);
    onStockUpdate(item.id, newVal);
  };

  // Stepper taps route through the same onStockUpdate debounce as typing.
  // preventDefault on mousedown keeps focus inside the input, so the
  // blur-and-snap-back below never fights an in-flight edit.
  const bump = (delta: number) => {
    const current = parseInt(val, 10);
    const base = Number.isFinite(current) ? current : 0;
    const next = Math.max(0, base + delta);
    if (next === base) return;
    setVal(String(next));
    onStockUpdate(item.id, String(next));
  };

  const severity = getSeverity(item.stock);
  const meta = SEVERITY_META[severity];
  const minusDisabled = val === "" || parseInt(val, 10) <= 0;

  return (
    <div className="stock-card" style={{ ...styles.card, borderTopColor: meta.accent }}>
      <div style={styles.header}>
        <div style={styles.idBlock}>
          <div style={styles.nameRow}>
            <span style={styles.vegMark(item.is_veg)} aria-hidden="true">
              <span style={styles.vegDot(item.is_veg)} />
            </span>
            <h4 style={styles.name} title={item.name}>
              {item.name}
            </h4>
          </div>
          <div style={styles.price}>{formatCurrency(item.price)}</div>
        </div>

        {canDelete && (
          <button
            type="button"
            style={styles.deleteButton}
            onClick={() => onDelete?.(item)}
            aria-label={`Delete ${item.name}`}
            title="Delete item"
          >
            <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      <div>
        <div style={styles.fieldLabel} id={`stock-label-${item.id}`}>
          Availability
        </div>
        <div className="stock-row" style={styles.stockRow}>
          <div style={styles.stepper}>
            <button
              type="button"
              style={minusDisabled ? { ...styles.stepButton, ...styles.stepButtonDisabled } : styles.stepButton}
              disabled={minusDisabled}
              aria-label={`Decrease stock of ${item.name}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => bump(-1)}
            >
              <Minus size={16} strokeWidth={2.25} aria-hidden="true" />
            </button>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={val}
              aria-labelledby={`stock-label-${item.id}`}
              aria-describedby={item.stock < 5 ? `stock-alert-${item.id}` : undefined}
              onFocus={() => {
                isEditing.current = true;
                setFocused(true);
              }}
              onBlur={() => {
                isEditing.current = false;
                setFocused(false);
                setVal(String(item.stock));
              }}
              onChange={handleChange}
              style={styles.stockInput(focused)}
            />

            <button
              type="button"
              style={styles.stepButton}
              aria-label={`Increase stock of ${item.name}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => bump(1)}
            >
              <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>

          <span className="stock-status" style={styles.chip(severity)}>
            <span style={styles.chipDot(severity)} aria-hidden="true" />
            {meta.label}
          </span>
        </div>
      </div>

      {item.stock < 5 && (
        <div id={`stock-alert-${item.id}`} style={styles.alert(item.stock <= 0 ? "out" : "critical")}>
          <TriangleAlert size={15} strokeWidth={2.25} aria-hidden="true" />
          {item.stock <= 0 ? "Out of stock — update the quantity once restocked." : "Low stock — restock soon."}
        </div>
      )}
    </div>
  );
}
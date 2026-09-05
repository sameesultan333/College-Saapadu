import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";

interface MenuItem { id: number; name: string; price: number; stock: number; is_veg: boolean }
interface CartItem extends MenuItem { quantity: number }

interface CounterTabProps {
  menu: MenuItem[];
  cart: CartItem[];
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemoveFromCart: (id: number) => void;
  getCartTotal: () => number;
  formatCurrency: (value: number) => string;
  onProceedToPayment: () => void;
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
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/* ------------------------------------------------------------------ */
/* Factories — standalone (cannot live inside a CSSProperties Record)  */
/* ------------------------------------------------------------------ */

type StockTone = "out" | "low" | "ok";

const stockTone = (stock: number): StockTone => (stock <= 0 ? "out" : stock <= 5 ? "low" : "ok");

const stockChipStyle = (tone: StockTone): CSSProperties => ({
  flex: "none",
  padding: "3px 9px",
  borderRadius: "var(--bc-radius-pill)",
  fontSize: "var(--bc-font-size-caption)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  backgroundColor:
    tone === "out"
      ? "var(--bc-color-danger-bg)"
      : tone === "low"
        ? "var(--bc-color-warning-bg)"
        : "var(--bc-color-neutral-bg)",
  color:
    tone === "out"
      ? "var(--bc-color-danger)"
      : tone === "low"
        ? "var(--bc-color-warning)"
        : "var(--bc-color-neutral-text)",
});

const stockLabel = (stock: number): string => (stock > 0 ? `${stock} left` : "Out of stock");

/* FSSAI classification mark — same motif as StockCard / AddMenuModal */
const vegMarkStyle = (isVeg: boolean): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 15,
  height: 15,
  border: `1.5px solid ${isVeg ? "var(--bc-color-success)" : "var(--bc-color-danger)"}`,
  borderRadius: 3,
  backgroundColor: "var(--bc-color-surface-raised)",
});
const vegDotStyle = (isVeg: boolean): CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: isVeg ? "var(--bc-color-success)" : "var(--bc-color-danger)",
});

/* Whole card is the tap target (original behavior, now a real <button>).
   Out-of-stock stays clickable so the parent's "out of stock" alert still
   informs staff — it's only dimmed, never disabled. */
const menuCardStyle = (out: boolean, hovered: boolean): CSSProperties => ({
  display: "grid",
  gap: "var(--bc-space-12)",
  alignContent: "start",
  minWidth: 0,
  padding: "var(--bc-space-card-padding)",
  textAlign: "left",
  font: "inherit",
  border: `1px solid ${hovered && !out ? "var(--bc-color-brand-primary-light)" : "var(--bc-color-border-subtle)"}`,
  borderRadius: "var(--bc-radius-lg)",
  backgroundColor: "var(--bc-color-surface-raised)",
  boxShadow: hovered && !out ? "var(--bc-shadow-card-hover)" : "var(--bc-shadow-card)",
  cursor: out ? "not-allowed" : "pointer",
  opacity: out ? 0.55 : 1,
  transform: hovered && !out ? "translateY(-1px)" : "none",
  transition:
    "box-shadow var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), transform var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const inCartPillStyle: CSSProperties = {
  flex: "none",
  minWidth: 22,
  padding: "1px 7px",
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: "var(--bc-color-brand-primary)",
  color: "var(--bc-color-text-inverse)",
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  textAlign: "center",
};

const stepperButtonStyle = (narrow: boolean): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: narrow ? 40 : 32,
  height: narrow ? 40 : 32,
  padding: 0,
  border: "1px solid var(--bc-color-border-default)",
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: "var(--bc-color-surface-raised)",
  color: "var(--bc-color-text-secondary)",
  cursor: "pointer",
  transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const removeButtonStyle = (narrow: boolean): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: narrow ? 40 : 32,
  height: narrow ? 40 : 32,
  padding: 0,
  border: "1px solid var(--bc-color-danger-border)",
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: "transparent",
  color: "var(--bc-color-danger)",
  cursor: "pointer",
  transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

/* ------------------------------------------------------------------ */
/* Static styles                                                       */
/* ------------------------------------------------------------------ */

const ROOT: CSSProperties = { minWidth: 0 };

const HEAD: CSSProperties = { marginBottom: "var(--bc-space-20)" };
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

const SECTION_HEAD: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--bc-space-8)",
  marginBottom: "var(--bc-space-12)",
};
const SECTION_TITLE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-section-heading)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  color: "var(--bc-color-text-primary)",
};
const SECTION_COUNT: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-muted)",
};

const CARD: CSSProperties = {
  background: "var(--bc-color-surface-raised)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-lg)",
  boxShadow: "var(--bc-shadow-card)",
  minWidth: 0,
};

/* Menu name truncates; price uses the brand green (menu identity) */
const ITEM_NAME: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
};
const ITEM_PRICE: CSSProperties = {
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-brand-primary)",
};

const CART: CSSProperties = {
  ...CARD,
  position: "sticky",
  top: "1.25rem",
  padding: "var(--bc-space-card-padding)",
};

const CART_LIST: CSSProperties = {
  display: "grid",
  gap: "var(--bc-space-8)",
  maxHeight: 420,
  overflowY: "auto",
  marginBottom: "var(--bc-space-16)",
};

const CART_ITEM: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-12)",
  padding: "var(--bc-space-8) var(--bc-space-12)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-surface-page-alt)",
};

const CART_INFO: CSSProperties = { flex: 1, display: "grid", gap: 2, minWidth: 0 };
const CART_ITEM_NAME: CSSProperties = {
  ...ITEM_NAME,
  whiteSpace: "normal",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
const CART_ITEM_PRICE: CSSProperties = {
  fontSize: "var(--bc-font-size-caption)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-muted)",
};
const QTY: CSSProperties = {
  minWidth: 26,
  textAlign: "center",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
};
const LINE_TOTAL: CSSProperties = {
  flex: "none",
  minWidth: 64,
  textAlign: "right",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
};

const TOTAL_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--bc-space-12)",
  paddingTop: "var(--bc-space-12)",
  borderTop: "1px dashed var(--bc-color-border-default)",
  marginBottom: "var(--bc-space-16)",
};
const TOTAL_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  color: "var(--bc-color-text-secondary)",
};
const TOTAL_VALUE: CSSProperties = {
  fontSize: "var(--bc-font-size-metric)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tighter)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
};

/* Terracotta — the design system's reserved action color. This is the
   tab's one primary CTA; everything else stays quiet. */
const CTA: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--bc-space-8)",
  width: "100%",
  minHeight: 46,
  padding: "0 var(--bc-space-16)",
  border: "1px solid transparent",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-brand-action)",
  color: "var(--bc-color-text-inverse)",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
};

const EMPTY: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-40) var(--bc-space-16)",
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
  opacity: 0.9,
};
const EMPTY_TITLE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  color: "var(--bc-color-text-secondary)",
};
const EMPTY_SUB: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-secondary)",
  color: "var(--bc-color-text-muted)",
};

/* Mobile dock bar — live order summary when the cart is off-screen */
const DOCK: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 200, /* --bc-z-sticky */
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-16)",
  padding: "10px var(--bc-space-16)",
  paddingBottom: "max(10px, env(safe-area-inset-bottom))",
  backgroundColor: "var(--bc-color-surface-raised)",
  borderTop: "1px solid var(--bc-color-border-subtle)",
  boxShadow: "var(--bc-shadow-elevated)",
};
const DOCK_META: CSSProperties = { flex: 1, display: "grid", gap: 1, minWidth: 0 };
const DOCK_COUNT: CSSProperties = {
  fontSize: "var(--bc-font-size-caption)",
  color: "var(--bc-color-text-muted)",
  fontVariantNumeric: "tabular-nums",
};
const DOCK_TOTAL: CSSProperties = {
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
};
const DOCK_BUTTON: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 44,
  padding: "0 var(--bc-space-20)",
  border: "1px solid transparent",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-brand-primary)",
  color: "var(--bc-color-text-inverse)",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export default function CounterTab({
  menu,
  cart,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  getCartTotal,
  formatCurrency,
  onProceedToPayment,
}: CounterTabProps) {
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const [hoverId, setHoverId] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION || !rootRef.current) return;
    const animation = rootRef.current.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = getCartTotal();
  const showDock = isNarrow && cart.length > 0;

  const scrollToCart = (): void => {
    cartRef.current?.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "start" });
  };

  const layoutStyle: CSSProperties = isNarrow
    ? { display: "grid", gap: "var(--bc-space-24)", gridTemplateColumns: "minmax(0, 1fr)" }
    : {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.9fr) minmax(280px, 1fr)",
        gap: "var(--bc-space-24)",
        alignItems: "start", /* lets the cart actually stick */
      };

  return (
    <div
      ref={rootRef}
      style={{ ...ROOT, paddingBottom: showDock ? 92 : undefined }}
    >
      <header style={HEAD}>
        <p style={EYEBROW}>Walk-in service</p>
        <h2 style={TITLE}>Counter Orders</h2>
        <p style={SUBTITLE}>Quick order entry for walk-in customers</p>
      </header>

      <div style={layoutStyle}>
        {/* ---------------- Menu ---------------- */}
        <section aria-label="Menu items">
          <div style={SECTION_HEAD}>
            <h3 style={SECTION_TITLE}>Menu Items</h3>
            <span style={SECTION_COUNT}>{menu.length} items</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 190px), 1fr))",
              gap: "var(--bc-space-card-gap)",
            }}
          >
            {menu.map((item) => {
              const tone = stockTone(item.stock);
              const inCart = cart.find((c) => c.id === item.id)?.quantity ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  style={menuCardStyle(tone === "out", hoverId === item.id)}
                  onMouseEnter={() => setHoverId(item.id)}
                  onMouseLeave={() => setHoverId((current) => (current === item.id ? null : current))}
                  onClick={() => onAddToCart(item)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--bc-space-8)", minWidth: 0 }}>
                    <span style={vegMarkStyle(item.is_veg)} aria-hidden="true">
                      <span style={vegDotStyle(item.is_veg)} />
                    </span>
                    <span style={ITEM_NAME} title={item.name}>
                      {item.name}
                    </span>
                    {inCart > 0 && <span style={inCartPillStyle} aria-label={`${inCart} in current order`}>×{inCart}</span>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--bc-space-8)" }}>
                    <span style={ITEM_PRICE}>{formatCurrency(item.price)}</span>
                    <span style={stockChipStyle(tone)}>{stockLabel(item.stock)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ---------------- Cart ---------------- */}
        <aside ref={cartRef} style={CART} aria-label="Current order">
          <div style={SECTION_HEAD}>
            <h3 style={SECTION_TITLE}>Current Order</h3>
            {cart.length > 0 && <span style={SECTION_COUNT}>{cartCount} items</span>}
          </div>

          {cart.length === 0 ? (
            <div style={EMPTY}>
              <span style={EMPTY_ICON} aria-hidden="true">
                <ShoppingBasket size={22} strokeWidth={1.75} />
              </span>
              <p style={EMPTY_TITLE}>No items yet</p>
              <p style={EMPTY_SUB}>Tap menu items to start the order.</p>
            </div>
          ) : (
            <>
              <div style={CART_LIST}>
                {cart.map((item) => (
                  <div key={item.id} style={CART_ITEM}>
                    <div style={CART_INFO}>
                      <span style={CART_ITEM_NAME}>{item.name}</span>
                      <span style={CART_ITEM_PRICE}>{formatCurrency(item.price)} each</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        style={stepperButtonStyle(isNarrow)}
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus size={14} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                      <span style={QTY} aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        style={{
                          ...stepperButtonStyle(isNarrow),
                          ...(item.quantity >= item.stock ? { opacity: 0.4, cursor: "not-allowed" } : null),
                        }}
                        aria-label={`Add one ${item.name}`}
                        disabled={item.quantity >= item.stock}
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </div>

                    <span style={LINE_TOTAL}>{formatCurrency(item.price * item.quantity)}</span>

                    <button
                      type="button"
                      style={removeButtonStyle(isNarrow)}
                      aria-label={`Remove ${item.name} from order`}
                      onClick={() => onRemoveFromCart(item.id)}
                    >
                      <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              <div style={TOTAL_ROW}>
                <span style={TOTAL_LABEL}>Total</span>
                <span style={TOTAL_VALUE}>{formatCurrency(total)}</span>
              </div>

              <button
                type="button"
                style={{ ...CTA, ...(hoverId === -1 ? { backgroundColor: "var(--bc-color-brand-action-hover)" } : null) }}
                onMouseEnter={() => setHoverId(-1)}
                onMouseLeave={() => setHoverId((current) => (current === -1 ? null : current))}
                onClick={onProceedToPayment}
              >
                Proceed to Payment
                <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
              </button>
            </>
          )}
        </aside>
      </div>

      {/* ---------------- Mobile dock bar ---------------- */}
      {showDock && (
        <div style={DOCK} aria-label="Order summary">
          <div style={DOCK_META}>
            <span style={DOCK_COUNT}>
              {cartCount} {cartCount === 1 ? "item" : "items"} in order
            </span>
            <span style={DOCK_TOTAL}>{formatCurrency(total)}</span>
          </div>
          <button type="button" style={DOCK_BUTTON} onClick={scrollToCart}>
            Review order
            <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
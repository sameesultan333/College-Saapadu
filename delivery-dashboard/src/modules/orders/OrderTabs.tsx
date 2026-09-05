import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ChefHat, PackageCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type OrderTab = "preparing" | "ready";

interface OrderTabsProps {
  activeTab: OrderTab;
  onChange: (tab: OrderTab) => void;
  preparingCount: number;
  readyCount: number;
}

/* ------------------------------------------------------------------ */
/* Tab semantics — amber = in motion (kitchen), teal = handoff (the    */
/* RouteMark pin). Text tones are AA-derived from the token values.    */
/* ------------------------------------------------------------------ */

interface TabMeta {
  label: string;
  icon: LucideIcon;
  tint: string;   // thumb fill
  border: string; // thumb inset ring + active pill fill
  text: string;   // active text (AA-checked)
}

const TAB_META: Record<OrderTab, TabMeta> = {
  preparing: {
    label: "In Kitchen",
    icon: ChefHat,
    tint: "var(--bc-color-brand-action-soft, #fdf3e8)",
    border: "var(--bc-color-brand-action, #d96f2b)",
    text: "var(--bc-color-brand-action-hover, #bf5d20)",
  },
  ready: {
    label: "Ready to Serve",
    icon: PackageCheck,
    tint: "rgba(76, 143, 122, 0.12)",
    border: "var(--bc-dlv-color-accent-2, #4c8f7a)",
    text: "#35705c",
  },
};

const TAB_ORDER: OrderTab[] = ["preparing", "ready"];

/* ------------------------------------------------------------------ */
/* Responsive                                                          */
/* ------------------------------------------------------------------ */

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent): void => setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/* ------------------------------------------------------------------ */
/* The sliding thumb — one slab behind both segments. `left` and the   */
/* inset ring transition together, so the fill visibly MORPHS amber →  */
/* teal as it travels. Inset box-shadow (not border) keeps the thumb   */
/* box exactly equal to the segment box — no size math to drift.       */
/* Reduced-motion is covered by the theme's global                     */
/* `transition-duration: 0.01ms !important` rule, which beats inline.  */
/* ------------------------------------------------------------------ */

const thumb = (index: 0 | 1, meta: TabMeta): CSSProperties => ({
  position: "absolute",
  top: 0,
  bottom: 0,
  left: index === 0 ? "0%" : "calc(50% + var(--bc-space-8, 8px) / 2)",
  width: "calc((100% - var(--bc-space-8, 8px)) / 2)",
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: meta.tint,
  boxShadow: `inset 0 0 0 1.5px ${meta.border}, var(--bc-shadow-subtle, 0 1px 2px rgba(58, 44, 32, 0.06))`,
  transition:
    "left 220ms var(--bc-motion-easing-standard, cubic-bezier(0.4, 0, 0.2, 1)), background-color 220ms var(--bc-motion-easing-standard, ease), box-shadow 220ms var(--bc-motion-easing-standard, ease)",
});

/* ------------------------------------------------------------------ */
/* Factories                                                           */
/* ------------------------------------------------------------------ */

const segStyle = (
  active: boolean,
  hovered: boolean,
  compact: boolean,
  meta: TabMeta
): CSSProperties => ({
  position: "relative",
  zIndex: 1, // above the thumb
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: compact ? 6 : 8,
  minHeight: compact ? 52 : 56,
  padding: compact ? "0 var(--bc-space-8, 8px)" : "0 var(--bc-space-16, 16px)",
  border: 0,
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: "transparent", // the thumb carries the fill
  color: active ? meta.text : hovered ? "var(--bc-color-text-primary)" : "var(--bc-color-text-secondary)",
  fontSize: compact ? "0.8125rem" : "0.9375rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  font: "inherit",
  fontFamily: "var(--bc-font-family, inherit)",
  transition: "color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease)",
});

/* Count pill states:
   - active            → filled with the segment color
   - inactive, count>0 → semantic SOFT tint ("work waiting here") so a
     courier notices pending orders in the tab they're NOT on
   - count 0           → hidden (original behavior) */
const countPill = (active: boolean, meta: TabMeta): CSSProperties => ({
  flex: "none",
  minWidth: 22,
  padding: "1px 7px",
  borderRadius: "var(--bc-radius-pill, 999px)",
  backgroundColor: active ? meta.border : meta.tint,
  color: active ? "#fffdf9" : meta.text,
  fontSize: "var(--bc-font-size-caption, 0.75rem)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  textAlign: "center",
  lineHeight: "18px",
});

/* ------------------------------------------------------------------ */
/* Static styles                                                       */
/* ------------------------------------------------------------------ */

/* Raised card with the amber spine — the docket motif from the login
   and boot screen, carried into the primary nav. */
const WRAP: CSSProperties = {
  position: "relative",
  display: "flex",
  padding: "var(--bc-space-8, 8px)",
  background: "var(--bc-color-surface-raised, #fff)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderTop: "3px solid var(--bc-dlv-color-accent, #d98e3b)",
  borderRadius: "var(--bc-radius-lg, 12px)",
  boxShadow: "var(--bc-shadow-card)",
  minWidth: 0,
};

const TRACK: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--bc-space-8, 8px)",
  width: "100%",
};

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

/**
 * "In Kitchen" / "Ready to Serve" tab switcher, with live count badges.
 * The active fill is a sliding thumb that morphs between the two stage
 * colors as it travels.
 */
export default function OrderTabs({ activeTab, onChange, preparingCount, readyCount }: OrderTabsProps) {
  const compact = useMediaQuery("(max-width: 480px)");
  const [hoverKey, setHoverKey] = useState<OrderTab | null>(null);

  const counts: Record<OrderTab, number> = { preparing: preparingCount, ready: readyCount };
  const activeIndex = TAB_ORDER.indexOf(activeTab) as 0 | 1;

  return (
    <div style={WRAP}>
      <div style={TRACK} role="group" aria-label="Order stage">
        {/* Thumb renders first so buttons stack above it */}
        <span style={thumb(activeIndex, TAB_META[activeTab])} aria-hidden="true" />

        {TAB_ORDER.map((tab) => {
          const meta = TAB_META[tab];
          const Icon = meta.icon;
          const active = activeTab === tab;
          const count = counts[tab];
          return (
            <button
              key={tab}
              type="button"
              style={segStyle(active, hoverKey === tab, compact, meta)}
              aria-pressed={active}
              aria-label={`${meta.label} — ${count} ${count === 1 ? "order" : "orders"}`}
              onMouseEnter={() => setHoverKey(tab)}
              onMouseLeave={() => setHoverKey((current) => (current === tab ? null : current))}
              onClick={() => onChange(tab)}
            >
              <Icon size={compact ? 16 : 18} strokeWidth={2.1} aria-hidden="true" />
              <span>{meta.label}</span>
              {count > 0 && <span style={countPill(active, meta)}>{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
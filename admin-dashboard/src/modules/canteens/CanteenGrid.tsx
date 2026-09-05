import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactElement } from "react";
import { ArrowRight, MapPin, Pencil, Plus, Store } from "lucide-react";

import { Canteen } from "./canteenService";

interface CanteenGridProps {
  canteens: Canteen[];
  onOpen: (canteen: Canteen) => void;
  onAddClick: () => void;
  onEditClick: (canteen: Canteen) => void;
}

/* ------------------------------------------------------------------ */
/* Motion / hover helpers — the established inline-style kit           */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Sprig — the brand mark shared with Header / Overview / Login        */
/* ------------------------------------------------------------------ */

function Sprig(): ReactElement {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V5" />
      <path d="M12 12C8.7 12 6.6 9.9 6.2 6.6 9.5 6.6 11.6 8.7 12 12Z" />
      <path d="M12 12c3.3 0 5.4-2.1 5.8-5.4C14.5 6.6 12.4 8.7 12 12Z" />
      <path d="M12 17.5c-2.6 0-4.2-1.6-4.6-4.2 2.6 0 4.2 1.6 4.6 4.2Z" />
      <path d="M12 17.5c2.6 0 4.2-1.6 4.6-4.2-2.6 0-4.2 1.6-4.6 4.2Z" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Factories — standalone (a CSSProperties Record cannot hold fns)     */
/* ------------------------------------------------------------------ */

const cardStyle = (hovered: boolean): CSSProperties => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "var(--bc-space-12)",
  padding: "var(--bc-space-20)",
  border: `1px solid ${hovered ? "var(--bc-color-border-strong)" : "var(--bc-color-border-subtle)"}`,
  borderRadius: "var(--bc-radius-lg)",
  backgroundColor: "var(--bc-color-surface-raised)",
  boxShadow: hovered ? "var(--bc-shadow-card-hover)" : "var(--bc-shadow-card)",
  transform: hovered ? "translateY(-2px)" : "none",
  transition:
    "box-shadow var(--bc-motion-duration-normal) var(--bc-motion-easing-standard), transform var(--bc-motion-duration-normal) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-normal) var(--bc-motion-easing-standard)",
  minWidth: 0,
});

const monogramStyle = (hovered: boolean): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  width: 44,
  height: 44,
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
  transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
  ...(hovered
    ? { backgroundColor: "var(--bc-color-brand-primary-soft)" }
    : null),
});

const openButtonStyle = (hovered: boolean): CSSProperties => ({
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 42,
  padding: "0 var(--bc-space-16)",
  border: "1px solid transparent",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: hovered ? "var(--bc-color-brand-primary-hover)" : "var(--bc-color-brand-primary)",
  color: "var(--bc-color-text-inverse)",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const editButtonStyle = (hovered: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 42,
  padding: "0 var(--bc-space-16)",
  border: `1px solid ${hovered ? "var(--bc-color-border-strong)" : "var(--bc-color-border-default)"}`,
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: hovered ? "var(--bc-color-surface-page-alt)" : "transparent",
  color: "var(--bc-color-text-secondary)",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const addButtonStyle = (hovered: boolean, focused: boolean): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--bc-space-8)",
  minHeight: 176,
  padding: "var(--bc-space-20)",
  textAlign: "center",
  font: "inherit",
  border: `1.5px dashed ${hovered || focused ? "var(--bc-color-brand-primary)" : "var(--bc-color-border-strong)"}`,
  borderRadius: "var(--bc-radius-lg)",
  backgroundColor: hovered || focused ? "var(--bc-color-brand-primary-faint)" : "transparent",
  color: hovered || focused ? "var(--bc-color-brand-primary)" : "var(--bc-color-text-muted)",
  cursor: "pointer",
  transition:
    "border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const closedBadgeStyle: CSSProperties = {
  position: "absolute",
  top: "var(--bc-space-12)",
  right: "var(--bc-space-12)",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 10px",
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: "var(--bc-color-danger-bg)",
  color: "var(--bc-color-danger-strong)",
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 700,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};
const CLOSED_DOT: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "currentColor",
  opacity: 0.85,
};

/* ------------------------------------------------------------------ */
/* Static styles                                                       */
/* ------------------------------------------------------------------ */

const ROOT: CSSProperties = { display: "grid", gap: "var(--bc-space-24)", minWidth: 0 };

const HEAD: CSSProperties = { display: "grid", gap: "var(--bc-space-4)" };
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

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 272px), 1fr))",
  gap: "var(--bc-space-card-gap)",
  alignItems: "stretch",
};

const CARD_BODY: CSSProperties = { display: "grid", gap: "var(--bc-space-4)", minWidth: 0 };
const CARD_TITLE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-section-heading)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  color: "var(--bc-color-text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const LOCATION: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: "var(--bc-font-size-secondary)",
  color: "var(--bc-color-text-muted)",
  overflow: "hidden",
};
const LOCATION_TEXT: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const CARD_INACTIVE: CSSProperties = { opacity: 0.72 };
const ACTIONS_ROW: CSSProperties = {
  display: "flex",
  gap: "var(--bc-space-8)",
  marginTop: "auto", /* pins actions to the card floor — equal-height cards */
};

const EMPTY: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-56) var(--bc-space-24)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-lg)",
  backgroundColor: "var(--bc-color-surface-raised)",
  boxShadow: "var(--bc-shadow-card)",
  textAlign: "center",
};
const EMPTY_ICON: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 56,
  height: 56,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
};

/* ------------------------------------------------------------------ */
/* Grid                                                                */
/* ------------------------------------------------------------------ */

// Manager's college-wide canteen list. Each card opens the existing
// operational dashboard (AdminDashboard) for that canteen; "+ Add
// Canteen" opens AddCanteenModal. Staff never see this — StaffDashboard is
// a separate, single-canteen shell.
export default function CanteenGrid({ canteens, onOpen, onAddClick, onEditClick }: CanteenGridProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [addFocused, setAddFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION || !rootRef.current) return;
    const animation = rootRef.current.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  const hoverProps = (id: string) => ({
    onMouseEnter: () => setHoverId(id),
    onMouseLeave: () => setHoverId((current) => (current === id ? null : current)),
  });

  /* The add tile was div onClick + tabIndex — now a real button so Enter
     and Space work natively. */
  const handleAddKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === "Enter" || e.key === " ") e.preventDefault(); // button handles it; keep form semantics clean
  };

  return (
    <div ref={rootRef} style={ROOT}>
      <header style={HEAD}>
        <p style={EYEBROW}>College</p>
        <h2 style={TITLE}>Your Canteens</h2>
        <p style={SUBTITLE}>Select a canteen to manage its orders, stock and counter</p>
      </header>

      {canteens.length === 0 ? (
        <div style={EMPTY}>
          <span style={EMPTY_ICON} aria-hidden="true">
            <Store size={22} strokeWidth={1.75} />
          </span>
          <h3 style={CARD_TITLE}>No canteens yet</h3>
          <p style={SUBTITLE}>Add your first canteen to get started</p>
        </div>
      ) : null}

      <div style={GRID}>
        {canteens.map((canteen) => {
          const hoverKey = `c-${canteen.id}`;
          const hovered = hoverId === hoverKey;
          return (
            <article
              key={canteen.id}
              style={{ ...cardStyle(hovered), ...(canteen.is_active ? null : CARD_INACTIVE) }}
              {...hoverProps(hoverKey)}
            >
              {!canteen.is_active && (
                <span style={closedBadgeStyle}>
                  <span style={CLOSED_DOT} aria-hidden="true" />
                  Closed
                </span>
              )}

              <span style={monogramStyle(hovered)} aria-hidden="true">
                <svg viewBox="0 0 24 24" width={24} height={24} focusable="false">
                  <Sprig />
                </svg>
              </span>

              <div style={CARD_BODY}>
                <h3 style={CARD_TITLE} title={canteen.name}>
                  {canteen.name}
                </h3>
                {canteen.location && (
                  <span style={LOCATION}>
                    <MapPin size={13} strokeWidth={2} aria-hidden="true" />
                    <span style={LOCATION_TEXT}>{canteen.location}</span>
                  </span>
                )}
              </div>

              <div style={ACTIONS_ROW}>
                <button
                  type="button"
                  style={editButtonStyle(hoverId === `edit-${canteen.id}`)}
                  {...hoverProps(`edit-${canteen.id}`)}
                  onClick={() => onEditClick(canteen)}
                >
                  <Pencil size={14} strokeWidth={2.25} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  style={openButtonStyle(hoverId === `open-${canteen.id}`)}
                  {...hoverProps(`open-${canteen.id}`)}
                  onClick={() => onOpen(canteen)}
                >
                  Open
                  <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}

        <button
          type="button"
          style={addButtonStyle(hoverId === "add", addFocused)}
          {...hoverProps("add")}
          onFocus={() => setAddFocused(true)}
          onBlur={() => setAddFocused(false)}
          onClick={onAddClick}
          onKeyDown={handleAddKeyDown}
        >
          <Plus size={26} strokeWidth={1.75} aria-hidden="true" />
          <span style={{ ...CARD_TITLE, color: "inherit" }}>Add Canteen</span>
        </button>
      </div>
    </div>
  );
}
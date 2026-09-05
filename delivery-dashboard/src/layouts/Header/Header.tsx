import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Bike, LogOut } from "lucide-react";

interface HeaderProps {
  canteenName: string;
  onLogout: () => void;
}

/* ------------------------------------------------------------------ */
/* Responsive — the JS replacement for @media                          */
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
/* RouteMark — the delivery signature from the login, as a quiet       */
/* desktop-only echo. One bicycle on this screen, and it's in the mark. */
/* ------------------------------------------------------------------ */

function RouteEcho(): ReactElement {
  return (
    <svg
      viewBox="0 0 120 32"
      width={120}
      height={32}
      aria-hidden="true"
      focusable="false"
      fill="none"
      style={{ flex: "none", opacity: 0.45 }}
    >
      <circle cx="8" cy="24" r="3.5" fill="var(--bc-dlv-color-accent, #d98e3b)" />
      <path
        d="M12 24 C 40 24, 44 8, 62 8 S 96 14, 104 14"
        stroke="var(--bc-dlv-color-accent, #d98e3b)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <circle cx="104" cy="14" r="5.5" stroke="var(--bc-dlv-color-accent-2, #4c8f7a)" strokeWidth={1.6} />
      <circle cx="104" cy="14" r="1.8" fill="var(--bc-dlv-color-accent-2, #4c8f7a)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Styles — light docket language. The bar's bottom edge curves; the
   amber accent is a border-bottom, so it follows the same curve.      */
/* ------------------------------------------------------------------ */

const TRANSITION =
  "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)";

/* The curve: rounded bottom corners on the sticky bar. Content scrolling
   underneath peeks through the corner notches — that's the intended look,
   and it's why the bar keeps a solid surface + shadow. */
const HEADER = (compact: boolean): CSSProperties => ({
  position: "sticky",
  top: 0,
  zIndex: 100, // original stacking preserved — the app's only fixed chrome
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--bc-space-16, 16px)",
  padding: compact
    ? "var(--bc-space-12, 12px) var(--bc-space-20, 20px)"
    : "var(--bc-space-16, 16px) clamp(1.5rem, 3vw, 3rem)",
  background: "var(--bc-color-surface-raised, #fff)",
  borderBottom: "2.5px solid var(--bc-dlv-color-accent, #d98e3b)",
  borderRadius: "0 0 22px 22px", // the "little curve"
  boxShadow: "var(--bc-shadow-card)",
  // Shadow of a rounded bar reads soft; no extra layer needed.
});

const BRAND: CSSProperties = { display: "flex", alignItems: "center", gap: "var(--bc-space-12, 12px)", minWidth: 0 };

const mark = (compact: boolean): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: compact ? 40 : 46,
  height: compact ? 40 : 46,
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: "var(--bc-color-brand-action-soft, #fdf3e8)",
  color: "var(--bc-color-brand-action, #d96f2b)",
  boxShadow: "inset 0 0 0 1px var(--bc-color-brand-action-soft, #fbeedd)",
});

const COPY: CSSProperties = { display: "grid", gap: 2, minWidth: 0 };

const NAME = (compact: boolean): CSSProperties => ({
  margin: 0,
  fontSize: compact ? "1.05rem" : "clamp(1.05rem, 0.95rem + 0.4vw, 1.3rem)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight, -0.01em)",
  lineHeight: "var(--bc-line-height-tight, 1.2)",
  color: "var(--bc-color-text-primary, #2b231c)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

/* Plain text — the bike lives in the mark, nowhere else */
const SUBTITLE: CSSProperties = {
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow, 0.08em)",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted, #6e6455)",
};

const LOGOUT = (compact: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  flex: "none",
  minHeight: compact ? 44 : 42,
  padding: compact ? "0 var(--bc-space-12, 12px)" : "0 var(--bc-space-16, 16px)",
  border: "1px solid var(--bc-color-border-default, #ddd0b5)",
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: "transparent",
  color: "var(--bc-color-text-secondary, #5b4f41)",
  fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: TRANSITION,
});
const LOGOUT_HOVER: CSSProperties = {
  backgroundColor: "var(--bc-color-danger-bg, #fbeae4)",
  borderColor: "var(--bc-color-danger-border, #efc6ba)",
  color: "var(--bc-color-danger, #b23b2e)",
};

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/**
 * Top chrome bar: canteen brand + logout action.
 * Shared across the whole Delivery Dashboard page.
 */
export default function Header({ canteenName, onLogout }: HeaderProps) {
  const compact = useMediaQuery("(max-width: 640px)");
  const [hoverLogout, setHoverLogout] = useState(false);

  return (
    <header style={HEADER(compact)}>
      <div style={BRAND}>
        <div style={mark(compact)} aria-hidden="true">
          <Bike size={compact ? 21 : 23} strokeWidth={1.9} />
        </div>
        <div style={COPY}>
          <h1 style={NAME(compact)} title={canteenName}>
            {canteenName}
          </h1>
          <span style={SUBTITLE}>Pickup Counter</span>
        </div>
      </div>

      {!compact && <RouteEcho />}

      <button
        type="button"
        style={{ ...LOGOUT(compact), ...(hoverLogout ? LOGOUT_HOVER : null) }}
        onMouseEnter={() => setHoverLogout(true)}
        onMouseLeave={() => setHoverLogout(false)}
        onClick={onLogout}
      >
        <LogOut size={16} strokeWidth={2.25} aria-hidden="true" />
        Logout
      </button>
    </header>
  );
}
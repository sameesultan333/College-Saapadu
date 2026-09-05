import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { ArrowLeft, LogOut } from "lucide-react";

interface HeaderProps {
  canteenName?: string;
  onLogout: () => void;
  onBack?: (() => void) | null;
  backLabel?: string;
  /** Line under the canteen name. */
  subtitle?: string;
  /** Connection pill; defaults on until a real socket-state prop is wired through. */
  live?: boolean;
  liveLabel?: string;
}

/* ------------------------------------------------------------------ */
/* Botanical mark — line-art sprig in brass. Vector, zero network,     */
/* crisp at every DPI. Used at mark size and as the header motif.      */
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

/** Right-edge signature: three fanned sprigs, masked to fade into the bar. */
function BrandMotif(): ReactElement {
  return (
    <svg viewBox="0 0 240 72" width="240" height="72" aria-hidden="true" focusable="false">
      <g transform="rotate(-14 60 60) translate(48 6) scale(2.15)"><Sprig /></g>
      <g transform="translate(96 6) scale(2.15)"><Sprig /></g>
      <g transform="rotate(14 180 60) translate(144 6) scale(2.15)"><Sprig /></g>
    </svg>
  );
}

/* Callers may pass the legacy "← Canteens"; the glyph comes from the
   icon, so a typed arrow in the label is stripped rather than doubled. */
const stripArrow = (label: string): string => label.replace(/^←\s*/, "");

/* ------------------------------------------------------------------ */
/* Responsive hook — the JS replacement for @media, since inline       */
/* styles cannot respond to the viewport. One matchMedia + change      */
/* listener per query; runs once per mount, never per navigation.      */
/* ------------------------------------------------------------------ */

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
/* Styles — module-scope, token-only, static where possible.           */
/* Functions only where a value is genuinely parametrized.             */
/* ------------------------------------------------------------------ */

const HEADER: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "var(--bc-color-brand-primary)",
  boxShadow: "var(--bc-shadow-header)",
};

const HAIRLINE: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 1,
  background: "var(--bc-color-white-alpha-10)",
  zIndex: 1,
};

const motif = (width: string, opacity: number): CSSProperties => ({
  position: "absolute",
  top: 0,
  bottom: 0,
  right: 0,
  zIndex: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  width,
  paddingRight: "var(--bc-space-24)",
  pointerEvents: "none",
  color: "var(--bc-color-brand-accent)",
  opacity,
  WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 58%)",
  maskImage: "linear-gradient(90deg, transparent 0%, #000 58%)",
});

const content = (narrow: boolean): CSSProperties => ({
  position: "relative",
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--bc-space-16)",
  width: "min(100%, var(--bc-layout-content-max-width))",
  marginInline: "auto",
  /* ≤760px theme.css pads .dashboard-header itself; the content yields */
  padding: narrow ? "var(--bc-space-4) 0" : "var(--bc-space-16) var(--bc-space-24)",
  minHeight: narrow ? undefined : "var(--bc-layout-header-height)",
});

const BRAND: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-12)",
  minWidth: 0,
};

const BACK_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginRight: "var(--bc-space-8)",
  padding: "0 var(--bc-space-16)",
  minHeight: 44,
  border: "1px solid var(--bc-color-white-alpha-25)",
  borderRadius: "var(--bc-radius-md)",
  background: "var(--bc-color-white-alpha-10)",
  color: "var(--bc-color-text-inverse)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 500,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const BACK_HOVER: CSSProperties = {
  background: "var(--bc-color-white-alpha-20)",
  borderColor: "var(--bc-color-white-alpha-40)",
};

const MARK: CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 40,
  height: 40,
  border: "1px solid var(--bc-color-white-alpha-10)",
  borderRadius: "var(--bc-radius-lg)",
  background: "var(--bc-color-white-alpha-10)",
  color: "var(--bc-color-brand-accent)",
};

const COPY: CSSProperties = { minWidth: 0 };

const TITLE: CSSProperties = {
  margin: 0,
  fontSize: "clamp(1.05rem, .95rem + .4vw, 1.3rem)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  lineHeight: "var(--bc-line-height-tight)",
  color: "var(--bc-color-text-inverse)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const subtitle = (narrow: boolean): CSSProperties => ({
  display: "block",
  marginTop: 2,
  fontSize: "var(--bc-font-size-caption)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  /* brass at caption size fails AA on green; only desktop gets brass */
  color: narrow ? "var(--bc-color-white-alpha-80)" : "var(--bc-color-brand-accent)",
});

const ACTIONS: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-16)",
};

const LIVE_PILL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--bc-space-8)",
  padding: "6px var(--bc-space-12)",
  border: "1px solid var(--bc-color-white-alpha-10)",
  borderRadius: "var(--bc-radius-pill)",
  background: "var(--bc-color-white-alpha-10)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 500,
  color: "var(--bc-color-white-alpha-80)",
  whiteSpace: "nowrap",
};

const LIVE_DOT: CSSProperties = {
  flex: "none",
  width: 7,
  height: 7,
  borderRadius: "var(--bc-radius-round)",
  background: "var(--bc-color-success-light)",
};

const SIGNOUT_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0 var(--bc-space-16)",
  minHeight: 44,
  border: "1px solid var(--bc-color-white-alpha-25)",
  borderRadius: "var(--bc-radius-md)",
  background: "transparent",
  color: "var(--bc-color-text-inverse)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 500,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const SIGNOUT_HOVER: CSSProperties = {
  background: "var(--bc-color-white-alpha-10)",
  borderColor: "var(--bc-color-white-alpha-40)",
};

/* The global :focus-visible outline is brand green — invisible on this
   surface. Focus here is state-tracked and gets a white ring instead.
   (It also shows on mouse-click focus: visible > invisible.) */
const FOCUS_RING: CSSProperties = {
  outline: "2px solid var(--bc-color-white-alpha-80)",
  outlineOffset: 2,
};

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

export default function Header({
  canteenName,
  onLogout,
  onBack,
  backLabel = "← Canteens",
  subtitle: subtitleText = "Kitchen Dashboard",
  live = true,
  liveLabel = "Live",
}: HeaderProps) {
  const isNarrow = useMediaQuery("(max-width: 760px)");
  const isTablet = useMediaQuery("(max-width: 1080px)");

  /* The inline-styles replacement for :hover / :focus */
  const [ui, setUi] = useState<{ hover: string | null; focus: string | null }>({
    hover: null,
    focus: null,
  });

  const interactive = (id: string) => ({
    onMouseEnter: () => setUi((s) => ({ ...s, hover: id })),
    onMouseLeave: () => setUi((s) => ({ ...s, hover: s.hover === id ? null : s.hover })),
    onFocus: () => setUi((s) => ({ ...s, focus: id })),
    onBlur: () => setUi((s) => ({ ...s, focus: s.focus === id ? null : s.focus })),
  });

  const buttonStyle = (id: string, base: CSSProperties, hovered: CSSProperties): CSSProperties => ({
    ...base,
    ...(ui.hover === id ? hovered : null),
    ...(ui.focus === id ? FOCUS_RING : null),
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  /* WAAPI replaces @keyframes (impossible inline). Two effects so the
     content settles exactly once while the dot can (re)start when the
     pill mounts after a narrow→desktop resize. Both guarded for
     reduced motion — the theme's global CSS rule doesn't reach WAAPI. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!contentRef.current) return;
    const animation = contentRef.current.animate(
      [{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }],
      { duration: 320, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  useEffect(() => {
    if (!live || isNarrow) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!dotRef.current) return;
    const animation = dotRef.current.animate(
      [{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }],
      { duration: 2400, iterations: Infinity, easing: "ease-in-out" }
    );
    return () => animation.cancel();
  }, [live, isNarrow]);

  const showMotif = !isNarrow;

  return (
    <header className="dashboard-header" style={HEADER}>
      {showMotif && (
        <div style={motif(isTablet ? "min(300px, 34%)" : "min(430px, 40%)", isTablet ? 0.12 : 0.17)} aria-hidden="true">
          <BrandMotif />
        </div>
      )}

      <span style={HAIRLINE} aria-hidden="true" />

      <div className="dashboard-header-content" style={content(isNarrow)} ref={contentRef}>
        <div className="dashboard-brand" style={BRAND}>
          {onBack && (
            <button type="button" className="dashboard-back-button" style={buttonStyle("back", BACK_BASE, BACK_HOVER)} {...interactive("back")} onClick={onBack}>
              <ArrowLeft size={15} strokeWidth={2.25} aria-hidden="true" />
              {stripArrow(backLabel)}
            </button>
          )}

          <div className="dashboard-brand-icon" style={MARK} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
              <Sprig />
            </svg>
          </div>

          <div className="dashboard-brand-copy" style={COPY}>
            <h1 style={TITLE}>{canteenName || "Kitchen Dashboard"}</h1>
            <span style={subtitle(isNarrow)}>{subtitleText}</span>
          </div>
        </div>

        <div className="dashboard-header-actions" style={ACTIONS}>
          {live && !isNarrow && (
            <span style={LIVE_PILL}>
              <span style={LIVE_DOT} ref={dotRef} aria-hidden="true" />
              {liveLabel}
            </span>
          )}

          <button type="button" className="dashboard-signout-button" style={buttonStyle("signout", SIGNOUT_BASE, SIGNOUT_HOVER)} {...interactive("signout")} onClick={onLogout}>
            <LogOut size={15} strokeWidth={2.25} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
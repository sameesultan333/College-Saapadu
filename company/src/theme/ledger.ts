/**
 * LEDGER THEME — the company portal's editorial paper system.
 *
 * Extracted from ManagersPage.tsx (the first screen built in this style)
 * so Layout.tsx and every console page share one palette instead of each
 * page redeclaring its own copy and drifting apart. Ink on cream,
 * hairline rules, one brass accent -- a printed ledger, not a SaaS admin
 * template.
 */
import type { CSSProperties } from "react";

/* ==================================================================== */
/* Tokens                                                                */
/* ==================================================================== */

export const PAPER = "#faf6ec";
export const PAPER_DEEP = "#f3edda";
export const INK = "#221c14";
export const INK_2 = "rgba(34, 28, 20, 0.66)";
export const INK_3 = "rgba(34, 28, 20, 0.42)";
export const HAIR = "rgba(34, 28, 20, 0.14)";
export const HAIR_SOFT = "rgba(34, 28, 20, 0.08)";
export const BRASS = "#b08d4f";
export const FOREST = "#1e3b2b";
export const FOREST_HOVER = "#15291e";
export const RED = "#a33526";
export const GREEN_DOT = "#3a6f44";

export const MONO = "var(--bc-login-font-family-mono, 'JetBrains Mono', ui-monospace, monospace)";

/* ==================================================================== */
/* Style factories                                                       */
/* ==================================================================== */

/** Underlined field — filling in a printed form, not a widget. */
export const field = (focused: boolean, wide: boolean): CSSProperties => ({
  width: "100%",
  boxSizing: "border-box",
  padding: wide ? "10px 2px" : "12px 2px",
  border: 0,
  borderBottom: `1.5px solid ${focused ? FOREST : HAIR}`,
  borderRadius: 0,
  background: "transparent",
  color: INK,
  font: "inherit",
  fontSize: "1rem",
  outline: "none",
  transition: "border-color 160ms ease",
});

export const textAction = (tone: "neutral" | "danger", hovered: boolean): CSSProperties => ({
  border: 0,
  padding: "2px 0",
  background: "transparent",
  color: tone === "danger" ? RED : hovered ? INK : INK_2,
  fontSize: "0.8125rem",
  fontWeight: 600,
  cursor: "pointer",
  font: "inherit",
  textDecoration: hovered ? "underline" : "none",
  textUnderlineOffset: 3,
  whiteSpace: "nowrap",
  transition: "color 140ms ease",
});

export const rowWash = (hovered: boolean): CSSProperties => ({
  background: hovered ? PAPER_DEEP : "transparent",
  transition: "background-color 160ms ease",
});

export const dot = (active: boolean): CSSProperties => ({
  flex: "none",
  width: 7,
  height: 7,
  borderRadius: "50%",
  border: `1.5px solid ${active ? GREEN_DOT : INK_3}`,
  backgroundColor: active ? GREEN_DOT : "transparent",
});

/* ==================================================================== */
/* Page shell                                                            */
/* ==================================================================== */

export const PAGE: CSSProperties = {
  minHeight: "100vh",
  boxSizing: "border-box",
  background: PAPER,
  color: INK,
  fontFamily: "var(--bc-font-family, Inter, system-ui, sans-serif)",
};

export const FRAME: CSSProperties = {
  maxWidth: 1160,
  margin: "0 auto",
  padding: "0 clamp(20px, 5vw, 56px) 96px",
};

/* ==================================================================== */
/* Masthead — one per app, rendered by Layout.tsx only                   */
/* ==================================================================== */

export const MAST: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 24,
  flexWrap: "wrap",
  padding: "26px 0 18px",
  borderBottom: `2px solid ${BRASS}`,
};
export const WORDMARK: CSSProperties = {
  margin: 0,
  fontSize: "0.8125rem",
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: INK,
};
export const MAST_NAV: CSSProperties = { display: "flex", alignItems: "center", gap: 22 };
export const mastLink = (active: boolean, hovered: boolean): CSSProperties => ({
  border: 0,
  padding: "2px 0",
  background: "transparent",
  font: "inherit",
  fontSize: "0.8125rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: active ? INK : INK_3,
  cursor: "pointer",
  textDecoration: active || hovered ? "underline" : "none",
  textUnderlineOffset: 4,
  textDecorationColor: active ? BRASS : undefined,
  transition: "color 140ms ease",
});
export const MAST_CONTEXT: CSSProperties = {
  margin: 0,
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  color: INK_3,
};
export const MAST_RIGHT: CSSProperties = { display: "flex", alignItems: "center", gap: 18 };
export const MAST_ADMIN: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.75rem",
  fontVariantNumeric: "tabular-nums",
  color: INK_3,
  whiteSpace: "nowrap",
};

/* ==================================================================== */
/* Auth — centered card, used only by LoginPage (no masthead/nav yet)    */
/* ==================================================================== */

export const AUTH_PAGE: CSSProperties = {
  minHeight: "100vh",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: PAPER,
  color: INK,
  fontFamily: "var(--bc-font-family, Inter, system-ui, sans-serif)",
};
export const AUTH_CARD: CSSProperties = {
  width: "100%",
  maxWidth: 380,
  boxSizing: "border-box",
  padding: "40px 36px 36px",
  border: `1px solid ${HAIR}`,
  borderTop: `3px solid ${BRASS}`,
  background: PAPER,
};
export const AUTH_WORDMARK: CSSProperties = { ...WORDMARK, textAlign: "center" };
export const AUTH_CONTEXT: CSSProperties = { ...MAST_CONTEXT, textAlign: "center", margin: "6px 0 0" };
export const AUTH_RULE: CSSProperties = { border: 0, borderTop: `2px solid ${INK}`, margin: "22px 0 28px" };
export const AUTH_FORM: CSSProperties = { display: "grid", gap: 22 };

/* ==================================================================== */
/* Title block — real editorial scale                                    */
/* ==================================================================== */

export const TITLE: CSSProperties = {
  margin: "52px 0 0",
  fontSize: "clamp(2.1rem, 1.5rem + 2.6vw, 3.1rem)",
  fontWeight: 700,
  letterSpacing: "-0.025em",
  lineHeight: 1.02,
  color: INK,
};
export const TITLE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 24,
  flexWrap: "wrap",
};
/** Ledger tally — counts set like figures in a book. */
export const TALLY: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  fontFamily: MONO,
  fontSize: "0.875rem",
  fontVariantNumeric: "tabular-nums",
  color: INK_2,
  paddingBottom: 8,
};
export const TALLY_STRONG: CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: INK,
};
export const SUB: CSSProperties = {
  margin: "14px 0 0",
  fontSize: "0.9375rem",
  color: INK_2,
  maxWidth: "52ch",
};
/** Heavy rule closes the title block. */
export const HEAVY_RULE: CSSProperties = {
  border: 0,
  borderTop: `2px solid ${INK}`,
  margin: "26px 0 0",
};

/* ==================================================================== */
/* Two-region ruled layout                                               */
/* ==================================================================== */

export const BODY_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "300px minmax(0, 1fr)",
  gap: 0,
  alignItems: "start",
};
export const BODY_STACK: CSSProperties = { display: "grid", minWidth: 0 };

/** Region label — small caps on a hairline. */
export const REGION_LABEL: CSSProperties = {
  margin: 0,
  padding: "22px 0 10px",
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: INK_3,
};

export const FORM_COL: CSSProperties = { paddingRight: 40 };
export const LIST_COL: CSSProperties = { paddingLeft: 40, borderLeft: `1px solid ${HAIR}`, minWidth: 0 };
/** Same as LIST_COL but for single-column (narrow viewport) layouts. */
export const LIST_COL_STACKED: CSSProperties = { ...LIST_COL, borderLeft: 0, paddingLeft: 0, paddingTop: 8 };

/* ==================================================================== */
/* Provision-style form                                                  */
/* ==================================================================== */

export const FORM: CSSProperties = { display: "grid", gap: 20, paddingBottom: 28 };
export const GROUP: CSSProperties = { display: "grid", gap: 6, minWidth: 0 };
export const LABEL: CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: INK_3,
};
export const PASSWORD_WRAP: CSSProperties = { position: "relative" };
export const EYE: CSSProperties = {
  position: "absolute",
  right: 0,
  top: 6,
  display: "grid",
  placeItems: "center",
  width: 30,
  height: 30,
  border: 0,
  background: "transparent",
  color: INK_3,
  cursor: "pointer",
};

/** The one button in the room — forest, sharp, editorial. */
export const primaryCta = (hovered: boolean, disabled: boolean): CSSProperties => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  minHeight: 48,
  padding: "0 18px",
  border: 0,
  borderRadius: 2,
  background: disabled ? "rgba(30, 59, 43, 0.4)" : hovered ? FOREST_HOVER : FOREST,
  color: "#faf6ec",
  fontSize: "0.875rem",
  fontWeight: 700,
  letterSpacing: "0.02em",
  cursor: disabled ? "default" : "pointer",
  font: "inherit",
  transition: "background-color 160ms ease",
});

/** Inline danger — left rule, no fill box. */
export const DANGER: CSSProperties = {
  margin: "16px 0 0",
  padding: "10px 0 10px 14px",
  borderLeft: `2px solid ${RED}`,
  color: RED,
  fontSize: "0.8125rem",
  fontWeight: 600,
};

/* ==================================================================== */
/* Registry — filterable list                                            */
/* ==================================================================== */

export const REG_HEAD: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
};
export const FILTER_WRAP: CSSProperties = { width: "min(100%, 300px)" };
export const filterField = (focused: boolean): CSSProperties => ({
  ...field(focused, true),
  fontSize: "0.875rem",
  padding: "8px 2px",
});

export const ROWS: CSSProperties = { borderTop: `1px solid ${HAIR}` };
export const ledgerRow = (hovered: boolean, columns = "44px minmax(0, 1fr) auto"): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: columns,
  gap: 18,
  alignItems: "center",
  padding: "16px 0",
  borderBottom: `1px solid ${HAIR_SOFT}`,
  ...rowWash(hovered),
});
export const INDEX: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.8125rem",
  fontVariantNumeric: "tabular-nums",
  color: INK_3,
  textAlign: "right",
};
export const ROW_MAIN: CSSProperties = { display: "grid", gap: 3, minWidth: 0 };
export const ROW_NAME: CSSProperties = { display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 };
export const NAME: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: INK,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
/** Dot leader between name and status — the book motif. */
export const LEADER: CSSProperties = {
  flex: 1,
  minWidth: 20,
  borderBottom: `1px dotted ${HAIR}`,
  transform: "translateY(-4px)",
};
export const STATUS: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.05em",
  color: INK_2,
  whiteSpace: "nowrap",
};
export const META: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.75rem",
  fontVariantNumeric: "tabular-nums",
  color: INK_2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
export const META_SEP: CSSProperties = { color: INK_3, padding: "0 7px" };
export const ROW_ACTIONS: CSSProperties = { display: "flex", gap: 18, alignItems: "center" };

/* ==================================================================== */
/* Empty state                                                           */
/* ==================================================================== */

export const EMPTY_BLOCK: CSSProperties = {
  borderTop: `1px solid ${HAIR}`,
  padding: "56px 0",
  display: "grid",
  gap: 8,
};
export const EMPTY_TITLE: CSSProperties = {
  margin: 0,
  fontSize: "1.25rem",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: INK,
};
export const EMPTY_SUB: CSSProperties = { margin: 0, fontSize: "0.875rem", color: INK_3 };

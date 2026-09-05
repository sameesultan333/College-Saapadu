/**
 * Centralized theme for the Delivery Dashboard app.
 *
 * JS mirror of `theme.css`. Every value below MUST match its CSS custom
 * property counterpart — the two files are one token system in two
 * languages:
 *
 *   theme.js   → consumed by JS/TS components (`theme.colors.x`)
 *   theme.css  → consumed by stylesheets (`var(--token-name)`)
 *
 * SYNC MAP (theme.js key → theme.css variable):
 *   colors.cream            → --cream
 *   colors.softOrange       → --soft-orange
 *   colors.deepOrange       → --deep-orange   (also --bc-color-brand-action)
 *   colors.freshGreen       → --fresh-green
 *   colors.darkBrown        → --dark-brown
 *   colors.neutralBg        → --neutral-bg    (also --bc-color-neutral-bg)
 *   colors.errorRed         → --error-red
 *   colors.login*           → --bc-dlv-* / --bc-login-* (delivery identity)
 *   shadows.card            → --card-shadow
 *   typography.fontFamily   → --bc-font-family
 *
 * Change a value here and change it there (and vice versa).
 *
 * REFINEMENT NOTES (values modernized, key names stable):
 *   - The neon orange family (#FFB347 / #FF8C42 / #FF9800) is pulled toward
 *     premium amber/terracotta; lime greens toward herb tones.
 *   - The dark login palette now carries the delivery identity
 *     (slate night + amber) instead of the old green-on-navy.
 *   - Shadows are layered and warm-tinted instead of single-drop.
 *   - The QR scanner block is intentionally UNCHANGED — its components
 *     depend on those exact slate/emerald values.
 */

export const colors = {
  // ---- Warm canteen palette (refined values, legacy keys) ----
  cream: "#f8f1e4", // page surface — deepened so white cards separate on warmth
  warmWhite: "#fffdf8", // card surface
  softOrange: "#f2a640", // was #FFB347
  deepOrange: "#d96f2b", // was #FF8C42 — terracotta direction; the portal's action color
  freshGreen: "#5f9e44", // was #7CB342 — herb, not lime
  lightGreen: "#8fbf6a", // was #9CCC65
  cookingOrange: "#e8891c", // was #FF9800
  warmGray: "#8a7263",
  darkBrown: "#43332a", // was #5D4037 — espresso text

  // ---- Secondary/accent tones (refined) ----
  green700: "#4e7f34",
  paleOrangeBg: "#fbeedd",
  paleOrangeBg2: "#fcf1e2",
  paleOrangeBg3: "#fdf3e8",
  paleGreenBg: "#e9f2e2",
  paleGreenBg2: "#f1f8ec",
  neutralBg: "#f4f1ea",
  neutralBorder: "#e3dccf",
  neutralBorder2: "#efeae0",
  itemsListBorder: "#e6decf",
  errorRed: "#b23b2e",
  errorBg: "#fbeae4",
  toastCloseGray: "#a79c8c",
  white: "#FFFFFF",
  black: "#000000",

  // ---- QR scanner palette (preserved verbatim — do not touch) ----
  scannerHeading: "#1a202c",
  scannerMuted: "#718096",
  scannerSeparator: "#cbd5e0",
  scannerStatusBg: "#f7fafc",
  scannerStatusText: "#2d3748",
  scannerCloseText: "#4a5568",
  scannerCloseBorder: "#e2e8f0",
  successGreen: "#10b981",
  successBgLight: "#d1fae5",
  successBgLight2: "#a7f3d0",
  successTextDark: "#065f46",
  errorRedBright: "#ef4444",
  errorBgLight: "#fee2e2",
  errorBgLight2: "#fecaca",
  errorTextDark: "#991b1b",

  // ---- Dark login palette → delivery identity (slate night + amber) ----
  loginBg: "#0e1417", // --bc-dlv-color-bg
  loginBorder: "rgba(244, 241, 234, 0.1)", // --bc-dlv-color-border
  loginText: "#f4f1ea", // --bc-dlv-color-text
  loginButtonFrom: "#d98e3b", // --bc-dlv-color-accent
  loginButtonTo: "#b8732a", // --bc-dlv-color-accent-strong
  loginButtonText: "#14100b", // ink on amber
  loginError: "#f2a9a2", // --bc-login-color-error-light
};

export const shadows = {
  card: "0 1px 2px rgba(58, 44, 32, 0.05), 0 4px 14px rgba(58, 44, 32, 0.05)",
  cardHover: "0 2px 4px rgba(58, 44, 32, 0.05), 0 10px 24px rgba(58, 44, 32, 0.1)",
};

export const typography = {
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  loginFontFamily: "Inter, system-ui, sans-serif",
};

/* ------------------------------------------------------------------ */
/* Additive sections — safe for legacy importers (new keys only).      */
/* New components should prefer these (or the --bc-* CSS variables)    */
/* over the legacy color keys above.                                   */
/* ------------------------------------------------------------------ */

// Shared brand + semantic system — mirrors the admin app so components
// port between portals. Values match --bc-color-* in theme.css.
export const brand = {
  primary: "#1e3b2b",
  primaryLight: "#2f5940",
  primaryHover: "#17301f",
  primarySoft: "#e3ebe1",
  primaryFaint: "#f2f6f0",
  secondary: "#7c9473",
  secondaryStrong: "#5e7256",
  accent: "#b08d4f",
  accentStrong: "#7c6132",
  action: "#d96f2b", // = colors.deepOrange — the delivery action color
  actionHover: "#bf5d20",
  actionPressed: "#a34f19",
  actionSoft: "#fbeedd",

  textPrimary: "#2b231c",
  textSecondary: "#5b4f41",
  textMuted: "#6e6455",
  textFaint: "#a79c8c",
  textInverse: "#fffdf9",

  borderSubtle: "#eae1cd",
  borderDefault: "#ddd0b5",
  borderStrong: "#a8916a",

  success: "#3a6f44",
  successBg: "#e7f2e5",
  successStrong: "#254c2d",
  warning: "#8c6a17",
  warningBg: "#fbf0da",
  warningStrong: "#5c4610",
  danger: "#b23b2e",
  dangerBg: "#fbeae4",
  dangerStrong: "#6e2419",
  info: "#3e6e8e",
  infoBg: "#e7f1f6",
  infoStrong: "#25475c",

  // Delivery identity — dark surfaces for login/portal chrome
  dlv: {
    bg: "#0e1417",
    panel: "rgba(20, 27, 31, 0.78)",
    border: "rgba(244, 241, 234, 0.1)",
    field: "rgba(244, 241, 234, 0.05)",
    text: "#f4f1ea",
    textMuted: "rgba(244, 241, 234, 0.62)",
    accent: "#d98e3b", // amber — motion / headlight
    accentStrong: "#b8732a",
    accent2: "#4c8f7a", // herb-teal — handoff (the RouteMark pin)
    accent2Deep: "#35705c", // AA text tone on tinted teal fills
  },
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
  round: "50%",
};

export const spacing = {
  2: 2,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  56: 56,
  cardPadding: 20,
  cardGap: 16,
  sectionGap: 32,
};

export const motion = {
  durationFast: 120,
  durationNormal: 200,
  durationSlow: 320,
  easingStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
  easingEnter: "cubic-bezier(0, 0, 0.2, 1)",
  easingExit: "cubic-bezier(0.4, 0, 1, 1)",
};

const theme = { colors, brand, shadows, typography, radius, spacing, motion };

export default theme;
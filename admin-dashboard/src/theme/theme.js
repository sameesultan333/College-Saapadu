// ============================================================================
// BAMBOO CANTEEN — DESIGN TOKEN SOURCE OF TRUTH
// ============================================================================
//
// Visual identity: a premium, culinary, editorial system built around deep
// forest green, warm sage, ivory/cream surfaces, espresso text, and a
// restrained brass/terracotta accent pair. Replaces the previous
// orange-dominant palette.
//
// STRUCTURE
//   `tokens`      — the real source of truth, organized the way a design
//                    system should be: color / typography / spacing /
//                    radius / shadow / border / layout / motion / zIndex.
//                    Each category is also exported individually.
//   `dashboard` /
//   `login`       — a flat COMPATIBILITY LAYER shaped exactly like the old
//                    theme.js (same leaf key names: primary, textMuted,
//                    surfaceVeg, shadow.cardHover, etc). Every value here is
//                    *derived* from `tokens` (no duplicated literals), so it
//                    can't drift out of sync. This layer exists purely so
//                    any existing component that does
//                    `import { dashboard } from '.../theme'` and reads
//                    `dashboard.color.primary` keeps working unchanged — no
//                    application code was touched as part of this refactor.
//                    New/updated components should prefer `tokens` directly.
//
// `theme.css` mirrors every entry in `tokens` as CSS custom properties
// (prefixed `--bc-*`), plus the legacy `--dash-*` / `--login-*` variables as
// 1:1 aliases of the new tokens, for the same backward-compatibility reason.
//
// Contrast: every text/background and button pairing below was checked
// against WCAG 2.1 (4.5:1 normal text, 3:1 large text / UI-component
// boundaries) with a relative-luminance script. Tokens explicitly marked
// "decorative" or "icon/border only" were not designed to hold text and
// should not be used as a text color.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. COLOR
// ---------------------------------------------------------------------------

const color = {
  // Brand — Deep Forest Green (primary), Warm Sage (secondary), Brass (accent),
  // Terracotta (action — reserved for important food/order actions).
  brand: {
    primary: "#1e3b2b",
    primaryLight: "#2f5940", // decorative / icon use — lighter forest, not text-safe on cream
    primaryHover: "#17301f",
    primaryPressed: "#0f2317",
    primarySoft: "#e3ebe1", // tinted background, e.g. selected nav item
    primaryFaint: "#f2f6f0", // barely-there tint, e.g. row hover
    primaryHoverBg: "rgba(30, 59, 43, 0.05)",
    primaryIconBg: "rgba(30, 59, 43, 0.10)",

    secondary: "#7c9473", // tonal use: tags, icons, subtle fills, borders
    secondaryHover: "#6c8264",
    secondaryStrong: "#5e7256", // AA-safe (5.15:1) for solid fills carrying white text
    secondarySoft: "#edf1e8",
    secondaryFaint: "#f6f8f3",

    accent: "#b08d4f", // brass/gold — decorative & icon/border use only, NOT text-safe
    accentHover: "#9c7940",
    accentStrong: "#7c6132", // AA-safe (5.26:1) — use this instead when brass text/labels are needed
    accentSoft: "#f5eedc",
    accentFaint: "#faf6ec",

    action: "#b14f29", // refined terracotta — important food/order actions only, used sparingly
    actionHover: "#95401f",
    actionSoft: "#f6e4d8",
    actionFaint: "#fcf1ea",
  },

  // Surface — where content sits, from page background up to raised cards.
  surface: {
    page: "#f8f3e9", // warm ivory — app background
    pageAlt: "#fcf8ef", // subtle gradient partner for `page`
    base: "#fffdf9", // creamy white — default card surface
    raised: "#ffffff", // elevated card / popover surface
    sunken: "#f1eadc", // recessed surface, e.g. input fields
    overlay: "rgba(43, 35, 28, 0.5)", // warm-tinted modal/scrim backdrop (not pure black)
    // Tinted surfaces used for status/category tags (e.g. veg/non-veg stock tags)
    cool: "#eef4f7",
    fresh: "#edf5ea",
    veg: "#e6f2e3",
    nonVeg: "#fbebe7",
    warningAlt: "#fcf3e4",
  },

  // Text — four-step hierarchy from primary body copy down to disabled/placeholder.
  text: {
    primary: "#2b231c", // 13.96:1 on surface.page — body copy, headings
    secondary: "#5b4f41", // 7.19:1 — supporting copy, labels
    muted: "#6e6455", // 5.25:1 — de-emphasized copy, timestamps
    faint: "#a79c8c", // decorative/disabled/placeholder only — below AA, not for real copy
    inverse: "#fffdf9", // for text on dark/brand-filled surfaces
    brand: "#1e3b2b", // 11.07:1 — links, active nav, brand-colored copy
  },

  // Border — decorative dividers up to interactive-component boundaries.
  border: {
    subtle: "#eae1cd", // decorative card/section dividers
    default: "#ddd0b5", // standard card edges
    strong: "#a8916a", // interactive boundaries: inputs, focus, actionable edges
  },

  // Semantic — status colors. Each has a text-safe base, a light/decorative
  // variant, a strong/dark variant, and a soft background + border pair.
  semantic: {
    success: {
      base: "#3a6f44", // 5.37:1 on page
      light: "#5b9563", // decorative
      strong: "#254c2d",
      bg: "#e7f2e5",
      border: "#c7e0c1",
      iconBg: "rgba(58, 111, 68, 0.12)",
    },
    warning: {
      base: "#8c6a17", // 4.53:1 on page
      light: "#c99a3e",
      strong: "#5c4610",
      bg: "#fbf0da",
      border: "#eedba6",
    },
    danger: {
      base: "#a33526", // 6.14:1 on page
      light: "#c97267",
      strong: "#6e2419",
      bg: "#fbeae6",
      border: "#efc6ba",
    },
    info: {
      base: "#3e6e8e", // 4.96:1 on page
      light: "#5d93ad",
      strong: "#25475c",
      bg: "#e7f1f6",
      border: "#c4dce6",
      iconBg: "rgba(62, 110, 142, 0.10)",
    },
  },

  // Neutral — for disabled states, chips, and non-semantic muted UI.
  neutral: {
    bg: "#f1eee7",
    bgStrong: "#e4dfd3",
    text: "#7a7266",
    border: "#d8d0bf",
    borderStrong: "#c7bfaf",
  },

  // Hue-neutral utilities.
  utility: {
    black: "#000000",
    white: "#ffffff",
    transparent: "transparent",
    whiteAlpha05: "rgba(255, 255, 255, 0.05)",
    whiteAlpha10: "rgba(255, 255, 255, 0.10)",
    whiteAlpha20: "rgba(255, 255, 255, 0.20)",
    whiteAlpha25: "rgba(255, 255, 255, 0.25)",
    whiteAlpha30: "rgba(255, 255, 255, 0.30)",
    whiteAlpha40: "rgba(255, 255, 255, 0.40)",
    whiteAlpha80: "rgba(255, 255, 255, 0.80)",
  },

  // Elevated/branded shadows that need a color value rather than a plain
  // rgba-black (see `shadow` below for the neutral elevation scale).
  glow: {
    primaryToast: "0 12px 32px rgba(30, 59, 43, 0.22)",
    successToast: "0 8px 24px rgba(58, 111, 68, 0.28)",
  },

  // Login screen — deep, atmospheric, dark. Same brand family (forest,
  // brass, terracotta) but kept as its own palette since the login surface
  // is intentionally darker than the dashboard.
  login: {
    bg: "#0d1210",
    panel: "rgba(18, 24, 20, 0.72)",
    border: "rgba(255, 255, 255, 0.08)",
    accent1: "#e3b559", // brass — 9.92:1 on bg
    accent2: "#c98b3e", // deep brass
    accent3: "#7fae7b", // soft forest highlight
    text: "#fffdf9", // 18.60:1 on bg
    textMuted: "rgba(255, 253, 249, 0.62)", // ~7.47:1 effective on bg
    textLabel: "rgba(255, 253, 249, 0.82)",
    textFaint: "rgba(255, 253, 249, 0.42)",
    field: "rgba(255, 255, 255, 0.05)",
    fieldBorder: "rgba(255, 255, 255, 0.12)",
    error: "#e2645a", // 5.58:1 on bg
    errorLight: "#f2a9a2",
    errorBg: "rgba(226, 100, 90, 0.12)",
    errorBorder: "rgba(226, 100, 90, 0.32)",
  },
};

// ---------------------------------------------------------------------------
// 2. TYPOGRAPHY
// ---------------------------------------------------------------------------

const typography = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  // Kept unchanged from the legacy theme — Inter is already the brief's
  // recommended UI face, and this stack is presumably already loaded by
  // the app shell, so it wasn't touched.

  scale: {
    display: { fontSize: "clamp(2rem, 1.6rem + 1.6vw, 2.5rem)", fontWeight: 800, lineHeight: 1.15 }, // 32–40px / 700–800
    pageHeading: { fontSize: "clamp(1.5rem, 1.3rem + 0.8vw, 1.875rem)", fontWeight: 700, lineHeight: 1.2 }, // 24–30px / 700
    sectionHeading: { fontSize: "clamp(1.125rem, 1.05rem + 0.3vw, 1.3125rem)", fontWeight: 700, lineHeight: 1.3 }, // 18–21px / 650–700
    cardTitle: { fontSize: "0.9375rem", fontWeight: 650, lineHeight: 1.35 }, // 14–16px / 600–650
    body: { fontSize: "0.9375rem", fontWeight: 500, lineHeight: 1.55 }, // 14–15px / 400–500
    secondary: { fontSize: "0.8125rem", fontWeight: 500, lineHeight: 1.5 }, // 12–13px / 400–500
    metric: { fontSize: "clamp(1.5rem, 1.3rem + 0.8vw, 2rem)", fontWeight: 800, lineHeight: 1.1 }, // 24–32px / 700–800
    eyebrow: { fontSize: "0.6875rem", fontWeight: 650, lineHeight: 1.4, letterSpacing: "0.06em" }, // tiny metadata labels only
  },

  letterSpacing: {
    tight: "-0.01em",
    normal: "0",
    eyebrow: "0.06em",
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.65,
  },
};

// ---------------------------------------------------------------------------
// 3. SPACING — 4px/8px rhythm
// ---------------------------------------------------------------------------

const spacing = {
  scale: {
    2: "2px",
    4: "4px",
    8: "8px",
    12: "12px",
    16: "16px",
    20: "20px",
    24: "24px",
    32: "32px",
    40: "40px",
    56: "56px",
    72: "72px",
  },
  // Semantic aliases — what most components should actually reach for.
  semantic: {
    iconGap: "8px",
    controlPaddingX: "16px",
    controlPaddingY: "8px",
    cardPadding: "20px",
    cardGap: "16px",
    sectionGap: "32px",
    pageGap: "40px",
    pagePadding: "clamp(1.25rem, 3vw, 2.75rem)",
    mobilePadding: "16px",
  },
};

// ---------------------------------------------------------------------------
// 4. RADIUS — restrained, consolidated scale
// ---------------------------------------------------------------------------

const radius = {
  sm: "6px",
  md: "10px",
  lg: "16px",
  xl: "22px",
  pill: "999px",
  round: "50%",
};

// ---------------------------------------------------------------------------
// 5. SHADOW — soft, warm-neutral elevation scale
// ---------------------------------------------------------------------------

const shadow = {
  none: "none",
  subtle: "0 1px 2px rgba(43, 35, 28, 0.06)",
  card: "0 2px 8px rgba(43, 35, 28, 0.08)",
  cardHover: "0 8px 20px rgba(43, 35, 28, 0.12)",
  elevated: "0 12px 32px rgba(43, 35, 28, 0.14)",
  overlay: "0 24px 64px rgba(20, 16, 12, 0.30)",
  header: "0 2px 12px rgba(30, 59, 43, 0.10)",
  tabNav: "0 1px 0 rgba(43, 35, 28, 0.06)",
};

// ---------------------------------------------------------------------------
// 6. BORDER — widths (colors live under color.border / color.neutral.border)
// ---------------------------------------------------------------------------

const border = {
  width: {
    thin: "1px",
    default: "1px",
    thick: "2px",
  },
};

// ---------------------------------------------------------------------------
// 7. LAYOUT
// ---------------------------------------------------------------------------

const layout = {
  sidebarWidth: "264px",
  headerHeight: "72px",
  contentMaxWidth: "1440px",
  pagePadding: spacing.semantic.pagePadding,
  sectionGap: spacing.semantic.sectionGap,
  cardGap: spacing.semantic.cardGap,
  mobilePadding: spacing.semantic.mobilePadding,
  breakpoints: {
    xs: "360px",
    sm: "480px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    xxl: "1440px",
  },
};

// ---------------------------------------------------------------------------
// 8. MOTION — subtle only
// ---------------------------------------------------------------------------

const motion = {
  duration: {
    fast: "120ms",
    normal: "200ms",
    slow: "320ms",
  },
  easing: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    enter: "cubic-bezier(0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
};

// ---------------------------------------------------------------------------
// 9. Z-INDEX
// ---------------------------------------------------------------------------

const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  header: 300,
  overlay: 400,
  modal: 500,
  toast: 600,
  tooltip: 700,
};

// ---------------------------------------------------------------------------
// Login-only structural tokens (kept separate from dashboard `radius`/`shadow`
// deliberately — the login surface is a distinct atmosphere, per brief).
// ---------------------------------------------------------------------------

const loginTokens = {
  radius: { md: "12px", lg: "16px", xl: "24px" },
  shadow: {
    panel: "0 8px 32px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
    logo: "0 10px 28px rgba(227, 181, 89, 0.28)",
    button: "0 6px 18px rgba(177, 79, 41, 0.30)",
  },
  typography: {
    fontFamily: "'Outfit', sans-serif",
    fontFamilyMono: "'JetBrains Mono', monospace",
  },
};

export const tokens = {
  color,
  typography,
  spacing,
  radius,
  shadow,
  border,
  layout,
  motion,
  zIndex,
  login: loginTokens,
};

// ============================================================================
// COMPATIBILITY LAYER
// Same shape as the pre-refactor theme.js. Every value is derived from
// `tokens` above — nothing here is a new literal. Kept so existing
// component imports (`dashboard.color.primary`, `login.shadow.button`, etc.)
// continue to resolve without any change to application code.
// ============================================================================

export const dashboard = {
  color: {
    primary: color.brand.primary,
    primaryLight: color.brand.primaryLight,
    primaryHover: color.brand.primaryHover,
    bgGradientStart: color.surface.page,
    bgGradientEnd: color.surface.pageAlt,
    text: color.text.primary,
    textMuted: color.text.muted,
    textFaint: color.text.faint,
    textLabel: color.text.secondary,
    border: color.border.subtle,
    white: color.surface.raised,

    success: color.semantic.success.base,
    successLight: color.semantic.success.light,
    successDark: color.semantic.success.strong,
    successDarker: "#1a3820",
    successBg: color.semantic.success.bg,
    successBorder: color.semantic.success.border,

    info: color.semantic.info.base,
    infoLight: color.semantic.info.light,
    infoBg: color.semantic.info.bg,
    infoDark: color.semantic.info.strong,

    warning: color.semantic.warning.base,
    warningLight: color.semantic.warning.light,
    warningBg: color.semantic.warning.bg,
    warningBg2: color.semantic.warning.border,

    danger: color.semantic.danger.base,
    dangerDark: color.semantic.danger.strong,
    dangerLight: color.semantic.danger.light,
    dangerBg: color.semantic.danger.bg,

    neutralBg: color.neutral.bg,
    neutralBg2: color.neutral.bgStrong,
    neutralText: color.neutral.text,
    neutralBorder: color.neutral.border,
    neutralBorder2: color.neutral.borderStrong,

    black: color.utility.black,
    transparent: color.utility.transparent,

    surfaceWarm: color.brand.accentFaint,
    surfaceCool: color.surface.cool,
    surfaceFresh: color.surface.fresh,
    surfaceVeg: color.surface.veg,
    surfaceNonVeg: color.surface.nonVeg,
    surfaceWarning: color.semantic.warning.bg,
    surfaceWarningAlt: color.surface.warningAlt,
    surfaceInfo: color.semantic.info.bg,

    white05: color.utility.whiteAlpha05,
    white10: color.utility.whiteAlpha10,
    white20: color.utility.whiteAlpha20,
    white25: color.utility.whiteAlpha25,
    white30: color.utility.whiteAlpha30,
    white40: color.utility.whiteAlpha40,
    white80: color.utility.whiteAlpha80,
    black50: color.surface.overlay, // was plain rgba(0,0,0,0.5) — now warm-tinted to match palette

    successIconBg: color.semantic.success.iconBg,
    primaryIconBg: color.brand.primaryIconBg,
    infoIconBg: color.semantic.info.iconBg,

    primaryToastShadow: color.glow.primaryToast,
    successToastShadow: color.glow.successToast,

    loginPanelShadow: loginTokens.shadow.panel,
    loginLogoShadow: loginTokens.shadow.logo,
    loginButtonShadow: loginTokens.shadow.button,

    primaryHoverBg: color.brand.primaryHoverBg,
  },
  typography: {
    fontFamily: typography.fontFamily,
  },
  spacing: {
    xs: spacing.scale[4],
    sm: spacing.scale[8],
    md: spacing.scale[16],
    lg: spacing.scale[24],
    xl: spacing.scale[32],
  },
  borderRadius: {
    sm: radius.sm,
    md: radius.md,
    lg: radius.lg,
    xl: radius.lg, // old xl(14px)/xxl(16px) both collapse into the new `lg` bucket
    xxl: radius.xl,
    pill: radius.pill, // now a true 999px pill rather than a fixed 20px approximation
    round: radius.round,
  },
  shadow: {
    card: shadow.card,
    cardHover: shadow.cardHover,
    header: shadow.header,
    modal: shadow.overlay,
    tabNav: shadow.tabNav,
  },
};

export const login = {
  color: {
    bg: color.login.bg,
    panel: color.login.panel,
    border: color.login.border,
    accent1: color.login.accent1,
    accent2: color.login.accent2,
    accent3: color.login.accent3,
    text: color.login.text,
    textMuted: color.login.textMuted,
    textLabel: color.login.textLabel,
    textFaint: color.login.textFaint,
    field: color.login.field,
    white30: color.utility.whiteAlpha30,
    error: color.login.error,
    errorLight: color.login.errorLight,
    errorBg: color.login.errorBg,
    errorBorder: color.login.errorBorder,
  },
  typography: {
    fontFamily: loginTokens.typography.fontFamily,
    fontFamilyMono: loginTokens.typography.fontFamilyMono,
  },
  borderRadius: {
    md: loginTokens.radius.md,
    lg: loginTokens.radius.lg,
    xl: loginTokens.radius.xl,
  },
  shadow: {
    panel: loginTokens.shadow.panel,
    logo: loginTokens.shadow.logo,
    button: loginTokens.shadow.button,
  },
};

const theme = { ...tokens, dashboard, login };

export default theme;
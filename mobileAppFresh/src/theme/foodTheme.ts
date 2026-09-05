/**
 * foodTheme.ts
 *
 * Centralized design tokens for the food-ordering flow: Canteen Selection,
 * Menu, and Checkout. Matches the approved design reference
 * ("Mobile app design reference-handoff.zip" → College Saapadu App.dc.html):
 * a forest-green + cream/sage palette, gold accent, and monospace numerals
 * for prices/tokens/timestamps -- not the coral/saffron "spicy food" look
 * the old per-screen .jsx palettes used.
 *
 * This is scoped to the food-ordering screens only. Login/Register/Wallet/
 * OrderHistory/TrackOrder keep their own local palettes untouched (see
 * src/theme/theme.js's own header comment) -- consolidating those too is a
 * separate, out-of-scope redesign.
 *
 * Font note: the reference uses Manrope (body) + IBM Plex Mono (numerals/
 * labels) via Google Fonts. Neither is bundled/linked into the RN app
 * (that needs native font linking, a bigger change than a theme file), so
 * this approximates with the platform system sans for body text and the
 * platform generic monospace for numerals -- the same layout/weight/rhythm,
 * without requiring a native rebuild. Swap `foodTypography.mono`/`.sans`
 * once the real fonts are linked.
 *
 * getFoodColors(isPeak) returns the full palette for either state, so a
 * screen only ever needs one call: `const C = getFoodColors(isPeak)`.
 */
import { Platform } from "react-native";

export interface FoodColors {
  bg: string;
  surface: string;
  surface2: string;
  warm: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  border: string;
  borderLight: string;
  shadow: string;

  /** Primary brand green (CTAs, prices, links, "open"/positive state). */
  action: string;
  /** Deeper forest green -- icons, emphasis text, pressed states. */
  forest: string;
  actionBg: string;
  actionGlow: string;

  /** Gold -- ratings, "best"/"top" badges, highlights. */
  accent: string;
  accentBg: string;

  green: string;
  greenBg: string;
  red: string;
  redBg: string;
  muted: string;

  peakBg: string;
  peakText: string;
  peakSurface: string;
  peakAccent: string;

  skeletonBase: string;
  skeletonHigh: string;
}

const LIGHT: FoodColors = {
  bg: "#FAF9F6",
  surface: "#FFFFFF",
  surface2: "#F2F1ED",
  warm: "#EAF3EC",
  ink: "#17201A",
  ink2: "#4A544C",
  ink3: "#667067",
  ink4: "#9AA39B",
  border: "#E4E8E4",
  borderLight: "#EFEDE8",
  shadow: "rgba(23,32,26,0.10)",

  action: "#2F7D4A",
  forest: "#14532D",
  actionBg: "#EAF3EC",
  actionGlow: "rgba(47,125,74,0.28)",

  accent: "#D99A4A",
  accentBg: "rgba(217,154,74,0.14)",

  green: "#2F7D4A",
  greenBg: "#EAF3EC",
  red: "#B4443A",
  redBg: "rgba(180,68,58,0.10)",
  muted: "#F2F1ED",

  peakBg: "#1F2A22",
  peakText: "#F3F1EA",
  peakSurface: "#243029",
  peakAccent: "#E2A159",

  skeletonBase: "#EAF3EC",
  skeletonHigh: "#DCEADF",
};

const PEAK: FoodColors = {
  ...LIGHT,
  bg: "#17201A",
  surface: "#243029",
  surface2: "#1C2620",
  warm: "#2B3A30",
  ink: "#F3F1EA",
  ink2: "#C8D0C9",
  ink3: "#8FA091",
  ink4: "#657267",
  border: "rgba(255,255,255,0.10)",
  borderLight: "rgba(255,255,255,0.07)",
  shadow: "rgba(0,0,0,0.30)",

  actionBg: "rgba(47,125,74,0.22)",
  accentBg: "rgba(217,154,74,0.20)",
  redBg: "rgba(180,68,58,0.20)",
  muted: "#2B3A30",

  skeletonBase: "#243029",
  skeletonHigh: "#2B3A30",
};

export function getFoodColors(isPeak: boolean): FoodColors {
  return isPeak ? PEAK : LIGHT;
}

export const foodTypography = {
  /** Approximates the reference's Manrope until the font is linked natively. */
  sans: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  /** Approximates the reference's IBM Plex Mono -- used for prices, tokens, timestamps. */
  mono: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
  serif: Platform.OS === "ios" ? "Georgia" : "serif",
  sizes: {
    xs: 9,
    sm: 10,
    sm2: 11,
    base: 12,
    md: 13,
    lg: 14,
    lg2: 15,
    xl: 17,
    xxl: 20,
  },
  weights: {
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    heavy: "800" as const,
    black: "900" as const,
  },
};

export const foodSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const foodRadius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  xxl: 20,
  pill: 999,
};

export function foodCardShadow(shadowColor: string) {
  return {
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  };
}

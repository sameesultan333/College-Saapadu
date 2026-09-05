/**
 * theme.js
 *
 * Centralized theme tokens for the shared app "chrome" — the
 * navigation-level UI that appears identically on every screen
 * (Header.jsx, Sidebar.jsx, AppLayout.jsx).
 *
 * IMPORTANT — read before adding more usages:
 * Each screen in src/screens/ (Login, Register, CanteenSelect, MenuPage,
 * Checkout, Wallet, OrderHistory, OrderSuccess, TrackOrder) already defines
 * its OWN local palette constant at the top of the file (usually named `C`
 * or `T`, e.g. "// ─── Palette ───"). These are intentionally different
 * warm/food-themed color systems per screen (coral+saffron, green success,
 * cream+accent, purple login gradient, etc.) — they are NOT the same design
 * system and do not share hex values with each other or with this file.
 * Consolidating them into one shared color palette would change how those
 * screens look, which is out of scope for this extraction (see project
 * instructions: no redesign, preserve exact visuals). Only the truly
 * shared, screen-independent chrome below has been centralized here.
 *
 * Values in this file were extracted as-is from Header.jsx and Sidebar.jsx
 * (the only components reused unmodified across every screen via
 * AppLayout.jsx) — no new colors/sizes were invented.
 */

export const theme = {
  colors: {
    // Neutral surfaces
    background: "#ffffff",
    surface: "#ffffff",
    surfaceMuted: "#f1f5f9", // Header back-button circle bg
    white: "#ffffff",

    // Borders / dividers
    border: "#e2e8f0", // Sidebar divider
    borderLight: "#eee", // Header bottom border

    // Text
    text: "#0f172a", // primary ink (titles, names)
    textMuted: "#64748b", // subtitles, secondary labels
    textSecondary: "#334155", // icon color (Bell, X)
    textTertiary: "#475569", // Sidebar menu item icon/text color

    // Brand / accent
    primary: "#6366f1", // avatar bg, role label (indigo)

    // Status / semantic
    danger: "#ef4444", // badges, logout button
    dangerDark: "#dc2626", // peak-hour emphasis text
    dangerBg: "#fee2e2", // peak indicator background
    warningBg: "#fff7ed", // peak header background
  },

  typography: {
    sizes: {
      xs: 10,
      sm: 11,
      sm2: 12,
      base: 13,
      md: 14,
      lg: 15,
      lg2: 16,
      xl: 18,
      xxl: 20,
    },
    weights: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },

  // Common paddingHorizontal / paddingVertical / gap values observed
  // repeated across Header.jsx and Sidebar.jsx.
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },

  // Common borderRadius values observed repeated across Header.jsx and
  // Sidebar.jsx (circular avatars/icons use half of width/height directly
  // and are left inline since they are computed, not fixed tokens).
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 10,
    xl: 16,
  },

  shadows: {
    // Sidebar drawer shadow
    drawer: {
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowOffset: { width: -4, height: 0 },
      shadowRadius: 10,
      elevation: 12,
    },
  },
};

export default theme;

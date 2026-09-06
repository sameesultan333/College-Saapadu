import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FocusEvent, FormEvent, KeyboardEvent, ReactElement } from "react";
import {
  CircleAlert,
  CookingPot,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ReceiptText,
  TriangleAlert,
  Wheat,
} from "lucide-react";

import { apiFetch } from "../services/apiClient";
import { AuthSession, setSession } from "../auth/session";

interface LoginProps {
  onLogin: () => void;
  notice?: string;
  /** Culinary accent photo (desktop brand column only). Defaults to the
      header asset; pass a dedicated login image path or null to disable. */
  imageSrc?: string | null;
}

/* ------------------------------------------------------------------ */
/* Motion / responsive helpers                                         */
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

function Spin({ children }: { children: ReactElement }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const animation = ref.current.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      { duration: 900, iterations: Infinity, easing: "linear" }
    );
    return () => animation.cancel();
  }, []);
  return (
    <span ref={ref} style={{ display: "inline-flex" }} aria-hidden="true">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Brand mark — the sprig from the dashboard Header and Overview hero. */
/* Login → header → overview: one motif, one brand.                    */
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
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const focusRing = (pct: number) => `color-mix(in srgb, var(--bc-login-color-accent-1) ${pct}%, transparent)`;

const GOLD_LINEAR =
  "linear-gradient(135deg, var(--bc-login-color-accent-1) 0%, var(--bc-login-color-accent-2) 100%)";

const TRANSITION =
  "border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), box-shadow var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)";

const WRAPPER: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "var(--bc-login-color-bg)",
  backgroundImage:
    "radial-gradient(circle, color-mix(in srgb, var(--bc-login-color-border) 55%, transparent) 1px, transparent 1px)",
  backgroundSize: "26px 26px",
  position: "relative",
  overflow: "hidden",
  fontFamily: "var(--bc-login-font-family)",
  padding: "var(--bc-space-20)",
  boxSizing: "border-box",
};

/* One deliberate anchored glow — light falling over the service counter —
   rather than scattered floating orbs. */
const COUNTER_GLOW: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "radial-gradient(60% 50% at 74% 40%, color-mix(in srgb, var(--bc-login-color-accent-1) 16%, transparent) 0%, transparent 70%)",
};

const INNER = (layout: "split" | "stacked", maxWidth: number): CSSProperties => ({
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth,
  display: "flex",
  flexDirection: layout === "split" ? "row" : "column",
  alignItems: layout === "split" ? "center" : "stretch",
  justifyContent: "center",
  gap: layout === "split" ? "clamp(2.5rem, 6vw, 4.5rem)" : "var(--bc-space-24)",
});

/* ---- Brand column / strip ---- */

const BRAND: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "grid",
  gap: "var(--bc-space-16)",
  position: "relative",
};

const WORDMARK_ROW: CSSProperties = { display: "flex", alignItems: "center", gap: "var(--bc-space-12)" };

const MARK: CSSProperties = {
  flex: "none",
  width: 44,
  height: 44,
  display: "grid",
  placeItems: "center",
  border: "1px solid var(--bc-login-color-border)",
  borderRadius: "var(--bc-login-radius-lg)",
  background: "var(--bc-login-color-field)",
  color: "var(--bc-login-color-accent-1)",
  boxShadow: "var(--bc-login-shadow-logo)",
};

const WORDMARK_TEXT: CSSProperties = {
  fontSize: "1.3rem",
  fontWeight: 700,
  color: "var(--bc-login-color-text)",
  letterSpacing: "0.02em",
};

const HEADLINE = (scale: "lg" | "md"): CSSProperties => ({
  margin: 0,
  fontSize: scale === "lg" ? "clamp(1.7rem, 1.4rem + 1.3vw, 2.25rem)" : "clamp(1.25rem, 1.1rem + 0.8vw, 1.6rem)",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: 1.15,
  color: "var(--bc-login-color-text)",
});

const SUB: CSSProperties = {
  margin: 0,
  fontSize: "0.9375rem",
  lineHeight: 1.65,
  color: "var(--bc-login-color-text-muted)",
  maxWidth: "42ch",
};

/* Receipt-style feature list: a leader-dot line per item, like a menu
   board price list. Real structural device for a canteen POS, not
   decoration. */
const FEATURE_LIST: CSSProperties = { display: "grid", gap: "var(--bc-space-16)" };
const FEATURE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "var(--bc-space-8)",
  paddingBottom: "var(--bc-space-12)",
  borderBottom: "1px dashed var(--bc-login-color-border)",
};
const FEATURE_LABEL: CSSProperties = {
  flex: "none",
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-8)",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--bc-login-color-text)",
  whiteSpace: "nowrap",
};
const FEATURE_LEADER: CSSProperties = {
  flex: 1,
  height: 0,
  borderBottom: "1px dotted var(--bc-login-color-text-faint)",
  marginBottom: 5,
  minWidth: 16,
};
const FEATURE_TAG: CSSProperties = {
  flex: "none",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--bc-login-color-accent-1)",
};
const FEATURE_SUB: CSSProperties = {
  margin: "0.375rem 0 0",
  fontSize: "0.8125rem",
  color: "var(--bc-login-color-text-muted)",
};

const FEATURES: Array<{ icon: ReactElement; label: string; tag: string; note: string }> = [
  {
    icon: <CookingPot size={15} strokeWidth={2} aria-hidden="true" />,
    label: "Live order queue",
    tag: "instant",
    note: "New orders land the moment they're placed.",
  },
  {
    icon: <Wheat size={15} strokeWidth={2} aria-hidden="true" />,
    label: "Fresh stock, always",
    tag: "real-time",
    note: "Availability updates across every counter.",
  },
  {
    icon: <ReceiptText size={15} strokeWidth={2} aria-hidden="true" />,
    label: "Sales & GST, ready",
    tag: "automatic",
    note: "Reports and tax summaries without spreadsheets.",
  },
];

function FeatureList(): ReactElement {
  return (
    <div style={FEATURE_LIST}>
      {FEATURES.map((f, i) => (
        <div key={f.label}>
          <div style={{ ...FEATURE_ROW, borderBottom: i === FEATURES.length - 1 ? "none" : FEATURE_ROW.borderBottom, paddingBottom: i === FEATURES.length - 1 ? 0 : FEATURE_ROW.paddingBottom }}>
            <span style={FEATURE_LABEL}>
              {f.icon}
              {f.label}
            </span>
            <span style={FEATURE_LEADER} aria-hidden="true" />
            <span style={FEATURE_TAG}>{f.tag}</span>
          </div>
          <p style={FEATURE_SUB}>{f.note}</p>
        </div>
      ))}
    </div>
  );
}

/* Photo band with a torn-ticket bottom edge — the panel photo settles
   into the page like a stub torn off a receipt, not a generic fade. */
const PHOTO_BAND: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  height: "clamp(150px, 18vh, 200px)",
  border: "1px solid var(--bc-login-color-border)",
  borderRadius: "var(--bc-login-radius-lg)",
};
const photoImg = (loaded: boolean): CSSProperties => ({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
  opacity: loaded ? 0.6 : 0,
  transform: loaded ? "none" : "scale(1.04)",
  transition: "opacity 700ms var(--bc-motion-easing-enter), transform 1200ms var(--bc-motion-easing-enter)",
});
const PHOTO_TINT: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(180deg, transparent 45%, var(--bc-login-color-bg) 92%)",
};
const PHOTO_TEAR: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: -1,
  height: 16,
  background: "var(--bc-login-color-bg)",
  WebkitMaskImage: "repeating-radial-gradient(circle at 9px 0px, transparent 0 6px, black 7px 18px)",
  maskImage: "repeating-radial-gradient(circle at 9px 0px, transparent 0 6px, black 7px 18px)",
};

/* ---- Form panel ---- */

const PANEL = (width: number | string): CSSProperties => ({
  position: "relative",
  flex: "none",
  width,
  maxWidth: "100%",
  boxSizing: "border-box",
  background: "var(--bc-login-color-panel)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid var(--bc-login-color-border)",
  borderRadius: "var(--bc-login-radius-xl)",
  padding: "clamp(1.75rem, 4vw, 3rem) clamp(1.5rem, 3.5vw, 2.5rem)",
  boxShadow: "var(--bc-login-shadow-panel)",
});

/* Dashed tear-stub seam — the perforation between a torn-off receipt
   stub and the panel it sits against. Split layout only. */
const PANEL_STUB: CSSProperties = {
  position: "absolute",
  left: -1,
  top: 28,
  bottom: 28,
  width: 1,
  backgroundImage: "repeating-linear-gradient(to bottom, var(--bc-login-color-border) 0 6px, transparent 6px 15px)",
};

const COMPACT_HEAD: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-12)",
  marginBottom: "var(--bc-space-24)",
};

const PANEL_HEAD: CSSProperties = { marginBottom: "var(--bc-space-24)" };

const FORM: CSSProperties = { display: "flex", flexDirection: "column", gap: "var(--bc-space-20)" };
const GROUP: CSSProperties = { display: "flex", flexDirection: "column", gap: "var(--bc-space-8)", minWidth: 0 };
const LABEL: CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--bc-login-color-text-label)",
};

const inputStyle = (focused: boolean): CSSProperties => ({
  boxSizing: "border-box",
  width: "100%",
  background: "var(--bc-login-color-field)",
  border: `1px solid ${focused ? "var(--bc-login-color-accent-1)" : "var(--bc-login-color-border)"}`,
  borderRadius: "var(--bc-login-radius-md)",
  padding: "0.9375rem 1.125rem",
  fontSize: "0.9375rem",
  color: "var(--bc-login-color-text)",
  fontFamily: "var(--bc-login-font-family-mono)",
  outline: "none",
  boxShadow: focused ? `0 0 0 3px ${focusRing(18)}` : "none",
  transition: TRANSITION,
});

const SELECT_WRAP: CSSProperties = { position: "relative" };
const CAPS_HINT: CSSProperties = {
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--bc-login-color-accent-1)",
};

const ERROR: CSSProperties = {
  background: "var(--bc-login-color-error-bg)",
  border: "1px solid var(--bc-login-color-error-border)",
  borderRadius: "var(--bc-login-radius-md)",
  padding: "0.75rem 1rem",
  display: "flex",
  alignItems: "flex-start",
  gap: "0.75rem",
  color: "var(--bc-login-color-error-light)",
  fontSize: "0.875rem",
};
const ERROR_ICON: CSSProperties = { flex: "none", marginTop: 1, color: "var(--bc-login-color-error)" };

const SUBMIT = (hovered: boolean, focused: boolean, pressed: boolean): CSSProperties => ({
  background: GOLD_LINEAR,
  border: "none",
  borderRadius: "var(--bc-login-radius-md)",
  padding: "1rem 1.5rem",
  fontSize: "0.9375rem",
  fontWeight: 600,
  color: "var(--bc-login-color-text)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.625rem",
  marginTop: "0.25rem",
  transform: pressed ? "scale(0.98)" : "none",
  boxShadow: focused ? `var(--bc-login-shadow-button), 0 0 0 3px ${focusRing(18)}` : "var(--bc-login-shadow-button)",
  filter: hovered && !focused && !pressed ? "brightness(1.05)" : "none",
  fontFamily: "var(--bc-login-font-family)",
  letterSpacing: "0.02em",
  transition:
    "transform 120ms var(--bc-motion-easing-standard), box-shadow var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), filter var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), opacity var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});
const SUBMIT_DISABLED: CSSProperties = { opacity: 0.6, cursor: "default", filter: "none", transform: "none" };

const FOOTER: CSSProperties = {
  marginTop: "var(--bc-space-24)",
  paddingTop: "var(--bc-space-16)",
  borderTop: "1px solid var(--bc-login-color-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};
const FOOTER_TEXT: CSSProperties = { fontSize: "0.8125rem", color: "var(--bc-login-color-text-faint)", margin: 0 };

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

// Staff/managers authenticate with Phone + Password against POST
// /staff/login. No College field: phone is globally unique across the
// whole platform now (see backend models.py StaffAccount.phone), so it
// alone identifies the account -- college is derived server-side, never
// selected by the client. College is still only ever chosen when a
// Company Admin creates a Manager or a Manager creates Staff.
export default function AdminLogin({ onLogin, notice, imageSrc = `${process.env.PUBLIC_URL}/brand/admin-header.png` }: LoginProps) {
  const wide = useMediaQuery("(min-width: 1000px)");
  const tabletUp = useMediaQuery("(min-width: 680px)");
  const layout: "split" | "stacked" = wide ? "split" : "stacked";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(notice || "");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [ui, setUi] = useState<{ hover: string | null; focus: string | null; press: string | null }>({
    hover: null,
    focus: null,
    press: null,
  });
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !panelRef.current) return;
    const animation = panelRef.current.animate(
      [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }],
      { duration: 360, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/staff/login", {
        method: "POST",
        body: JSON.stringify({
          phone,
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.detail || "Invalid credentials. Please try again.");
        setLoading(false);
        return;
      }

      // A valid phone + password only proves who the account is, not that
      // it belongs in this portal -- a Delivery account is scoped to
      // pickup/handoff, not kitchen operations. Reject it here rather than
      // letting it land on a dashboard that then just fails to load data.
      if (data.role !== "manager" && data.role !== "staff") {
        setError("This account cannot access the admin dashboard.");
        setLoading(false);
        return;
      }

      const session: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        role: data.role,
        college_id: data.college_id,
        canteen_id: data.canteen_id ?? null,
        name: data.name,
      };

      setSession(session);
      setLoading(false);
      onLogin();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  };

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>): void => setCapsLock(e.getModifierState("CapsLock"));

  const trackCapsOnFocus = (e: FocusEvent<HTMLInputElement>): void => {
    const nativeEvent = e.nativeEvent as unknown as { getModifierState?: (key: string) => boolean };
    setCapsLock(nativeEvent.getModifierState?.("CapsLock") ?? false);
  };

  const hoverProps = (id: string) => ({
    onMouseEnter: () => setUi((s) => ({ ...s, hover: id })),
    onMouseLeave: () => setUi((s) => ({ ...s, hover: s.hover === id ? null : s.hover })),
  });
  const focusProps = (id: string) => ({
    onFocus: () => setUi((s) => ({ ...s, focus: id })),
    onBlur: () => setUi((s) => ({ ...s, focus: s.focus === id ? null : s.focus })),
  });
  const pressProps = (id: string) => ({
    onMouseDown: () => setUi((s) => ({ ...s, press: id })),
    onMouseUp: () => setUi((s) => ({ ...s, press: s.press === id ? null : s.press })),
    onMouseLeave: () => setUi((s) => ({ ...s, press: s.press === id ? null : s.press, hover: s.hover === id ? null : s.hover })),
  });

  const showPhoto = wide && imageSrc != null && !photoFailed;

  const Wordmark = ({ compact = false }: { compact?: boolean }) => (
    <div style={WORDMARK_ROW}>
      <div style={{ ...MARK, width: compact ? 40 : 44, height: compact ? 40 : 44 }}>
        <svg viewBox="0 0 24 24" width={compact ? 20 : 22} height={compact ? 20 : 22} aria-hidden="true" focusable="false">
          <Sprig />
        </svg>
      </div>
      <span style={WORDMARK_TEXT}>COLLEGE SAAPAADU</span>
    </div>
  );

  return (
    <div className="login-screen" style={WRAPPER}>
      <div aria-hidden="true" style={COUNTER_GLOW} />

      <div style={INNER(layout, layout === "split" ? 1040 : tabletUp ? 560 : 440)}>
        {wide && (
          <div style={BRAND}>
            <Wordmark />
            <div>
              <h2 style={{ ...HEADLINE("lg"), marginTop: "var(--bc-space-16)" }}>The kitchen, under control.</h2>
              <p style={{ ...SUB, marginTop: "var(--bc-space-8)" }}>
                One console for every canteen you run — from the first order of the day to the last GST filing.
              </p>
            </div>

            {showPhoto && (
              <div style={PHOTO_BAND} aria-hidden="true">
                <img
                  src={imageSrc}
                  alt=""
                  decoding="async"
                  style={photoImg(photoLoaded)}
                  onLoad={() => setPhotoLoaded(true)}
                  onError={() => setPhotoFailed(true)}
                />
                <span style={PHOTO_TINT} />
                <span style={PHOTO_TEAR} />
              </div>
            )}

            <FeatureList />
          </div>
        )}

        {tabletUp && !wide && (
          <div style={{ display: "grid", gap: "var(--bc-space-16)" }}>
            <Wordmark />
            <div>
              <h2 style={HEADLINE("md")}>The kitchen, under control.</h2>
              <p style={{ ...SUB, marginTop: "var(--bc-space-8)" }}>
                One console for every canteen you run, from the morning rush to the GST filing.
              </p>
            </div>
            <FeatureList />
          </div>
        )}

        <div
          className="login-panel"
          ref={panelRef}
          style={PANEL(layout === "split" ? 440 : "100%")}
        >
          {layout === "split" && <span aria-hidden="true" style={PANEL_STUB} />}

          {!tabletUp && (
            <div style={COMPACT_HEAD}>
              <Wordmark compact />
            </div>
          )}

          {(wide || (tabletUp && !wide)) && (
            <div style={PANEL_HEAD}>
              <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--bc-login-color-text)" }}>
                Sign in
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: "0.875rem", color: "var(--bc-login-color-text-muted)" }}>
                Use your registered phone number and password.
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} style={FORM}>
            <div style={GROUP}>
              <label htmlFor="phone" style={LABEL}>
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                required
                autoFocus
                style={inputStyle(ui.focus === "phone")}
                {...focusProps("phone")}
              />
            </div>

            <div style={GROUP}>
              <label htmlFor="password" style={LABEL}>
                Password
              </label>
              <div style={SELECT_WRAP}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle(ui.focus === "password"), paddingRight: "3rem" }}
                  onFocus={(e) => {
                    setUi((s) => ({ ...s, focus: "password" }));
                    trackCapsOnFocus(e);
                  }}
                  onBlur={() => {
                    setUi((s) => ({ ...s, focus: s.focus === "password" ? null : s.focus }));
                    setCapsLock(false);
                  }}
                  onKeyUp={trackCaps}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: "0.5rem",
                    transform: "translateY(-50%)",
                    display: "grid",
                    placeItems: "center",
                    width: 36,
                    height: 36,
                    border: 0,
                    borderRadius: "var(--bc-login-radius-md)",
                    background: "transparent",
                    color:
                      ui.hover === "toggle" || ui.focus === "toggle" || ui.focus === "password"
                        ? "var(--bc-login-color-accent-1)"
                        : "var(--bc-login-color-text-muted)",
                    cursor: "pointer",
                  }}
                  {...hoverProps("toggle")}
                  {...focusProps("toggle")}
                >
                  {showPassword ? <EyeOff size={17} strokeWidth={2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2} aria-hidden="true" />}
                </button>
              </div>
              {capsLock && (
                <p style={CAPS_HINT} role="status">
                  <TriangleAlert size={13} strokeWidth={2.25} aria-hidden="true" />
                  Caps Lock is on
                </p>
              )}
            </div>

            {error && (
              <div style={ERROR} role="alert">
                <CircleAlert size={18} strokeWidth={2} style={ERROR_ICON} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              style={{
                ...SUBMIT(ui.hover === "submit", ui.focus === "submit", ui.press === "submit"),
                ...(loading ? SUBMIT_DISABLED : null),
              }}
              disabled={loading}
              {...hoverProps("submit")}
              {...focusProps("submit")}
              {...pressProps("submit")}
            >
              {loading && (
                <Spin>
                  <Loader2 size={16} strokeWidth={2.5} aria-hidden="true" />
                </Spin>
              )}
              {loading ? "Authenticating..." : "Access dashboard"}
            </button>
          </form>

          <div style={FOOTER}>
            <Lock size={12} strokeWidth={2.25} style={{ color: "var(--bc-login-color-text-faint)" }} aria-hidden="true" />
            <p style={FOOTER_TEXT}>Secured by Campus Operations</p>
          </div>
        </div>
      </div>
    </div>
  );
}
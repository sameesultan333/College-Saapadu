import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactElement } from "react";
import {
  ArrowRight,
  Bike,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";

import { API } from "../config/api";
import { apiFetch, apiGet } from "../services/apiClient";
import { AuthSession, setSession, updateSession } from "../auth/session";

interface Canteen {
  id: number;
  name: string;
  is_active: boolean;
}

interface DeliveryLoginProps {
  onLogin: () => void;
}

/* ------------------------------------------------------------------ */
/* Motion / responsive helpers — the established inline-style kit      */
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
/* RouteMark — pickup node → dashed route → handoff pin. The portal's  */
/* signature; it reappears on the dashboard header.                    */
/* ------------------------------------------------------------------ */

function RouteMark({ width = 168 }: { width?: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 120 32"
      width={width}
      height={(width * 32) / 120}
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <circle cx="8" cy="24" r="4" fill="var(--bc-dlv-color-accent, #d98e3b)" />
      <path
        d="M12 24 C 40 24, 44 8, 62 8 S 96 14, 104 14"
        stroke="var(--bc-dlv-color-accent, #d98e3b)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <circle cx="104" cy="14" r="6.5" stroke="var(--bc-dlv-color-accent-2, #4c8f7a)" strokeWidth={1.8} />
      <circle cx="104" cy="14" r="2.2" fill="var(--bc-dlv-color-accent-2, #4c8f7a)" />
    </svg>
  );
}

/* Background route — desktop decoration, faint and non-interactive */
function BackdropRoute(): ReactElement {
  return (
    <svg
      viewBox="0 0 1440 480"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      fill="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <path
        d="M-40 420 C 260 380, 300 160, 620 180 S 1080 340, 1500 120"
        stroke="var(--bc-dlv-color-accent, #d98e3b)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="2 14"
        opacity={0.14}
      />
      <path
        d="M-40 120 C 320 60, 560 300, 900 260 S 1240 200, 1500 300"
        stroke="var(--bc-dlv-color-accent-2, #4c8f7a)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="2 14"
        opacity={0.1}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Styles — light day-dispatch language on the app's cream surfaces.   */
/* The dark-sphere/glass construction of the admin login is the        */
/* deliberate opposite; nothing here uses it.                          */
/* ------------------------------------------------------------------ */

const TRANSITION =
  "border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), box-shadow var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)";

const PAGE: CSSProperties = {
  minHeight: "100vh",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--bc-space-24) var(--bc-space-16)",
  background: "var(--bc-color-surface-page)",
  color: "var(--bc-color-text-primary)",
  fontFamily: "var(--bc-font-family)",
  position: "relative",
  overflow: "hidden",
};

/* The docket — a dispatch ticket, not a floating panel */
const DOCKET: CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "min(100%, 660px)",
  boxSizing: "border-box",
  background: "var(--bc-color-surface-raised)",
  border: "1px solid var(--bc-color-border-default)",
  borderTop: "4px solid var(--bc-dlv-color-accent, #d98e3b)", // rail: the docket's amber spine
  borderRadius: "var(--bc-radius-lg)",
  boxShadow: "var(--bc-shadow-elevated)",
};

const STRIP: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--bc-space-12)",
  minWidth: 0,
  padding: "var(--bc-space-24) var(--bc-space-40)",
  borderBottom: "1px solid var(--bc-color-border-subtle)",
};

const STRIP_MARK: CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 40,
  height: 40,
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-brand-action-soft, #fdf3e8)",
  color: "var(--bc-color-brand-action, #d96f2b)",
};

const STRIP_COPY: CSSProperties = { display: "grid", gap: 1, minWidth: 0 };
const STRIP_NAME: CSSProperties = {
  fontSize: "clamp(1.05rem, 0.95rem + 0.45vw, 1.35rem)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  color: "var(--bc-color-text-primary)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const STRIP_SUB: CSSProperties = {
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted)",
};

/* "Shift check-in" chip — amber, mirrors the route accent */
const CHIP: CSSProperties = {
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: "var(--bc-color-brand-action-soft, #fdf3e8)",
  color: "var(--bc-color-brand-action, #d96f2b)",
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const BODY: CSSProperties = { padding: "var(--bc-space-40) var(--bc-space-40) var(--bc-space-32)" };

const HEADLINE: CSSProperties = {
  margin: 0,
  fontSize: "clamp(1.4rem, 1.2rem + 1vw, 2rem)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  lineHeight: "var(--bc-line-height-tight)",
  color: "var(--bc-color-text-primary)",
  wordBreak: "break-word",
};
const SUB: CSSProperties = {
  margin: "var(--bc-space-8) 0 0",
  fontSize: "var(--bc-font-size-body)",
  lineHeight: "var(--bc-line-height-normal)",
  color: "var(--bc-color-text-muted)",
};

const ROUTE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-12)",
  margin: "var(--bc-space-20) 0 var(--bc-space-24)",
  minWidth: 0,
};
const ROUTE_CAPTION: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontSize: "var(--bc-font-size-caption)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted)",
  whiteSpace: "nowrap",
};

const FORM: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--bc-space-24)",
  width: "100%",
  minWidth: 0,
};
const GROUP: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--bc-space-8)",
  width: "100%",
  minWidth: 0,
};
const LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  color: "var(--bc-color-text-secondary)",
};

/* Courier ergonomics: 50px targets, 16px input text (no iOS zoom) */
const inputStyle = (focused: boolean): CSSProperties => ({
  boxSizing: "border-box",
  width: "100%",
  minHeight: 58,
  padding: "1rem 1.125rem",
  background: "var(--bc-color-surface-base, #fffdf8)",
  border: `1px solid ${focused ? "var(--bc-dlv-color-accent, #d98e3b)" : "var(--bc-color-border-default)"}`,
  borderRadius: "var(--bc-radius-md)",
  fontSize: "1.0625rem",
  color: "var(--bc-color-text-primary)",
  outline: "none",
  boxShadow: focused ? "0 0 0 3px rgba(217, 142, 59, 0.18)" : "none",
  transition: TRANSITION,
});

const PASSWORD_WRAP: CSSProperties = { position: "relative" };
const TOGGLE: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: "0.5rem",
  transform: "translateY(-50%)",
  display: "grid",
  placeItems: "center",
  width: 42,
  height: 42,
  border: 0,
  borderRadius: "var(--bc-radius-md)",
  background: "transparent",
  color: "var(--bc-color-text-muted)",
  cursor: "pointer",
};

const ERROR: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-12)",
  border: "1px solid var(--error-red, #b23b2e)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--error-bg, #fbeae4)",
  color: "var(--error-red, #b23b2e)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
};
const ERROR_ICON: CSSProperties = { flex: "none", marginTop: 1 };

const SUBMIT = (hovered: boolean, focused: boolean): CSSProperties => ({
  width: "100%",
  boxSizing: "border-box",
  minHeight: 58,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--bc-space-8)",
  border: "none",
  borderRadius: "var(--bc-radius-md)",
  padding: "0 1.25rem",
  background: "var(--bc-color-brand-action, #d96f2b)",
  color: "var(--bc-color-text-inverse)",
  fontSize: "1.0625rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
  cursor: "pointer",
  boxShadow: focused ? "0 0 0 3px rgba(217, 142, 59, 0.22)" : "none",
  transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), box-shadow var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
  ...({} as Record<string, never>),
});
const SUBMIT_HOVER: CSSProperties = {
  backgroundColor: "var(--bc-color-brand-action-hover, #bf5d20)",
};
const SUBMIT_DISABLED: CSSProperties = { opacity: 0.55, cursor: "default" };

/* Perforation + punch holes — the receipt tear before the stub */
const PERFORATION: CSSProperties = {
  position: "relative",
  borderTop: "2px dashed var(--bc-color-border-default)",
  margin: "var(--bc-space-4) 0",
};
const PUNCH = (side: "left" | "right"): CSSProperties => ({
  position: "absolute",
  top: -9,
  [side]: -10,
  width: 18,
  height: 18,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "var(--bc-color-surface-page)",
  border: "1px solid var(--bc-color-border-default)",
} as CSSProperties);

const STUB: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--bc-space-12)",
  padding: "var(--bc-space-12) var(--bc-space-20) var(--bc-space-16)",
  backgroundColor: "var(--bc-color-surface-page-alt, #fdf8ef)",
  borderBottomLeftRadius: "var(--bc-radius-lg)",
  borderBottomRightRadius: "var(--bc-radius-lg)",
};
const STUB_TEXT: CSSProperties = {
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: "var(--bc-font-size-caption)",
  fontWeight: 600,
  letterSpacing: "0.03em",
  color: "var(--bc-color-text-muted)",
};
const STUB_MARK: CSSProperties = { color: "var(--bc-color-success, #3a6f44)", flex: "none" };

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

// Replaces the old hardcoded per-canteen-code login (DELIVERY_ACCOUNTS map).
// Delivery couriers/Managers authenticate with Phone + Password against
// POST /staff/login, same as admin-dashboard's Manager/Staff login. No
// College field: phone is globally unique across the whole platform now
// (see backend models.py StaffAccount.phone), so it alone identifies the
// account. That endpoint authenticates ANY StaffAccount (manager/staff/
// delivery) — this screen allows "delivery" and "manager" in (a Manager
// has authority over everything in their college, including delivery) but
// rejects "staff" (kitchen/counter accounts aren't meant for this portal).
export default function DeliveryLogin({ onLogin }: DeliveryLoginProps) {
  const wide = useMediaQuery("(min-width: 900px)");

  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ui, setUi] = useState<{ hover: string | null; focus: string | null }>({ hover: null, focus: null });

  const docketRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION || !docketRef.current) return;
    const animation = docketRef.current.animate(
      [{ opacity: 0, transform: "translateY(12px) rotate(-0.4deg)" }, { opacity: 1, transform: "none" }],
      { duration: 340, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  /* Marching dashes on the route motif — the page's one ambient motion */
  useEffect(() => {
    if (REDUCED_MOTION || !routeRef.current) return;
    const animation = routeRef.current.animate(
      [{ backgroundPosition: "0px 50%" }, { backgroundPosition: "24px 50%" }],
      { duration: 1400, iterations: Infinity, easing: "linear" }
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
          password: pass,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.detail || "Invalid credentials. Please try again.");
        setLoading(false);
        return;
      }

      if (data.role !== "delivery" && data.role !== "manager") {
        setError("This account cannot access the delivery portal.");
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

      if (data.role === "delivery") {
        setSession(session);

        // The login response doesn't carry the canteen name — fetch it from
        // /staff/me so the dashboard header can show it.
        try {
          const me = await apiGet("/staff/me");
          if (me?.canteen_name) updateSession({ canteen_name: me.canteen_name });
        } catch {
          // non-fatal — dashboard falls back to a generic label
        }
      } else {
        // Manager: a manager token has no fixed canteen_id (college-wide
        // scope). This portal has no canteen switcher for managers — they
        // get the same single-canteen delivery screen a courier sees, so
        // resolve one canteen from their college and use it. Backend
        // authorization already allows a manager to act on any canteen in
        // their own college regardless of which one we pick here.
        let canteens: Canteen[] = [];
        try {
          const res = await fetch(`${API}/canteens?college_id=${data.college_id}`);
          if (res.ok) canteens = await res.json();
        } catch {
          // handled by the empty-canteens check below
        }

        if (canteens.length === 0) {
          setError("No canteens found for your college yet. Create one in the Manager Dashboard first.");
          setLoading(false);
          return;
        }

        session.canteen_id = canteens[0].id;
        session.canteen_name = canteens[0].name;
        setSession(session);
      }

      setLoading(false);
      onLogin();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  };

  const hoverProps = (id: string) => ({
    onMouseEnter: () => setUi((s) => ({ ...s, hover: id })),
    onMouseLeave: () => setUi((s) => ({ ...s, hover: s.hover === id ? null : s.hover })),
  });
  const focusProps = (id: string) => ({
    onFocus: () => setUi((s) => ({ ...s, focus: id })),
    onBlur: () => setUi((s) => ({ ...s, focus: s.focus === id ? null : s.focus })),
  });

  return (
    <div style={PAGE}>
      {wide && <BackdropRoute />}

      <div ref={docketRef} style={DOCKET}>
        {/* Ticket header strip */}
        <div
          style={
            wide
              ? STRIP
              : {
                  ...STRIP,
                  padding: "var(--bc-space-16)",
                  flexWrap: "wrap",
                }
          }
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--bc-space-12)", minWidth: 0 }}>
            <div style={STRIP_MARK} aria-hidden="true">
              <Bike size={21} strokeWidth={2} />
            </div>
            <div style={STRIP_COPY}>
              <span style={STRIP_NAME}>COLLEGE SAAPAADU</span>
              <span style={STRIP_SUB}>Delivery Portal</span>
            </div>
          </div>
          <span style={CHIP}>
            <PackageCheck size={13} strokeWidth={2.25} aria-hidden="true" />
            Shift check-in
          </span>
        </div>

        {/* Ticket body */}
        <div style={wide ? BODY : { ...BODY, padding: "var(--bc-space-28) var(--bc-space-20) var(--bc-space-24)" }}>
          <h1 style={HEADLINE}>Start your shift</h1>
          <p style={SUB}>Check in to pick up today&apos;s route from your canteen.</p>

          <div style={ROUTE_ROW}>
            <RouteMark width={wide ? 168 : 140} />
            <span style={ROUTE_CAPTION}>Kitchen → Handoff</span>
          </div>

          <form onSubmit={handleLogin} style={FORM}>
            <div style={GROUP}>
              <label htmlFor="dlv-phone" style={LABEL}>
                Phone Number
              </label>
              <input
                id="dlv-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                autoFocus
                required
                style={inputStyle(ui.focus === "phone")}
                {...focusProps("phone")}
              />
            </div>

            <div style={GROUP}>
              <label htmlFor="dlv-password" style={LABEL}>
                Password
              </label>
              <div style={PASSWORD_WRAP}>
                <input
                  id="dlv-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                  style={{ ...inputStyle(ui.focus === "password"), paddingRight: "3.5rem" }}
                  {...focusProps("password")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  style={{
                    ...TOGGLE,
                    color:
                      ui.hover === "toggle" || ui.focus === "toggle" || ui.focus === "password"
                        ? "var(--bc-dlv-color-accent, #d98e3b)"
                        : "var(--bc-color-text-muted)",
                  }}
                  {...hoverProps("toggle")}
                  {...focusProps("toggle")}
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={2} aria-hidden="true" /> : <Eye size={18} strokeWidth={2} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <div style={ERROR} role="alert">
                <CircleAlert size={17} strokeWidth={2} style={ERROR_ICON} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              style={{
                ...SUBMIT(ui.hover === "submit", ui.focus === "submit"),
                ...(ui.hover === "submit" && ui.focus !== "submit" && !loading ? SUBMIT_HOVER : null),
                ...(loading ? SUBMIT_DISABLED : null),
              }}
              disabled={loading}
              {...hoverProps("submit")}
              {...focusProps("submit")}
            >
              {loading && (
                <Spin>
                  <Loader2 size={17} strokeWidth={2.5} aria-hidden="true" />
                </Spin>
              )}
              {loading ? "Checking in…" : "Check in"}
              {!loading && <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />}
            </button>
          </form>
        </div>

        {/* Tear line + stub */}
        <div style={PERFORATION}>
          <span style={PUNCH("left")} aria-hidden="true" />
          <span style={PUNCH("right")} aria-hidden="true" />
        </div>

        <div style={STUB}>
          <p style={STUB_TEXT}>
            <ShieldCheck size={14} strokeWidth={2.1} style={STUB_MARK} aria-hidden="true" />
            Scoped to your canteen · Verified handoffs
          </p>
        </div>
      </div>
    </div>
  );
}
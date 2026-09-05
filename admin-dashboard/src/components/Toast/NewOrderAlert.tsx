import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { BellRing, X } from "lucide-react";

interface Notification {
  id: number | string;
  time: string;
}

interface NewOrderAlertProps {
  notification: Notification | null;
  onClick: () => void;
  onDismiss: () => void;
  /** Visual countdown sync. Defaults to 5000 — pass AdminDashboard's
      NEW_ORDER_ALERT_MS so the bar can never drift from the real timer. */
  autoDismissMs?: number;
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

/* ------------------------------------------------------------------ */
/* Styles — factories standalone (a CSSProperties Record cannot hold   */
/* functions); static values token-only.                               */
/* ------------------------------------------------------------------ */

const TRANSITION =
  "transform var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)";

/* Legacy stacking: the app's toasts live above its modals (1005 > any
   --bc-z value). Kept from the original to avoid a stacking regression. */
const WRAPPER = (narrow: boolean): CSSProperties => ({
  position: "fixed",
  bottom: 24,
  right: narrow ? 12 : 24,
  left: narrow ? 12 : undefined,
  zIndex: 1005,
  display: narrow ? "block" : "flex",
  justifyContent: "flex-end",
  pointerEvents: "none",
});

const cardStyle = (hovered: boolean, narrow: boolean): CSSProperties => ({
  pointerEvents: "auto",
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-16)",
  minWidth: narrow ? 0 : 360,
  maxWidth: 440,
  padding: "var(--bc-space-20) var(--bc-space-24) var(--bc-space-20) var(--bc-space-20)",
  borderLeft: "4px solid var(--bc-color-brand-primary)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderLeftWidth: 4,
  borderLeftColor: "var(--bc-color-brand-primary)",
  borderRadius: "var(--bc-radius-lg)",
  backgroundColor: "var(--bc-color-surface-raised)",
  boxShadow: hovered ? "var(--bc-shadow-hover, 0 16px 40px rgba(43, 35, 28, 0.2))" : "var(--bc-shadow-elevated)",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  transform: hovered ? "translateY(-4px) scale(1.02)" : "none",
  borderColor: hovered ? "var(--bc-color-border-strong)" : "var(--bc-color-border-subtle)",
  transition: TRANSITION,
});

const MEDALLION: CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 48,
  height: 48,
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
};

const TEXT: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
const TITLE: CSSProperties = {
  margin: 0,
  fontSize: "1.0625rem",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  color: "var(--bc-color-text-primary)",
};
const DETAIL: CSSProperties = {
  margin: 0,
  fontSize: "0.9375rem",
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const CLOSE: CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 36,
  height: 36,
  padding: 0,
  border: 0,
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: "transparent",
  color: "var(--bc-color-text-muted)",
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
};
const CLOSE_HOVER: CSSProperties = {
  backgroundColor: "var(--bc-color-neutral-bg)",
  color: "var(--bc-color-text-primary)",
};

/* Time-remaining bar — anchored to the rail so it reads as part of it */
const PROGRESS_TRACK: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 3,
  backgroundColor: "var(--bc-color-brand-primary-faint)",
};
const PROGRESS_FILL: CSSProperties = {
  display: "block",
  height: "100%",
  backgroundColor: "var(--bc-color-brand-primary)",
  transformOrigin: "left",
};

const SR_ONLY: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

/* ------------------------------------------------------------------ */
/* Alert                                                               */
/* ------------------------------------------------------------------ */

// Extracted verbatim from the inline `newOrderNotification` block in
// AdminDashboard.jsx; presentation and a11y rebuilt, contract unchanged.
export default function NewOrderAlert({
  notification,
  onClick,
  onDismiss,
  autoDismissMs = 5000,
}: NewOrderAlertProps) {
  const narrow = useMediaQuery("(max-width: 640px)");
  const [hover, setHover] = useState<"card" | "close" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);

  const activeId = notification?.id;

  /* Entrance slide + bell ring + countdown, re-run per notification so a
     second order re-announces with fresh motion. */
  useEffect(() => {
    if (activeId === undefined || activeId === null) return;

    const cleanups: Array<() => void> = [];

    if (!REDUCED_MOTION) {
      if (cardRef.current) {
        const entrance = cardRef.current.animate(
          [
            { opacity: 0, transform: "translateX(48px)" },
            { opacity: 1, transform: "translateX(0)" },
          ],
          { duration: 320, easing: "cubic-bezier(0, 0, 0.2, 1)" }
        );
        cleanups.push(() => entrance.cancel());
      }
      if (bellRef.current) {
        // One restrained ring on arrival — not a loop.
        const ring = bellRef.current.animate(
          [
            { transform: "rotate(0deg)" },
            { transform: "rotate(-14deg)" },
            { transform: "rotate(11deg)" },
            { transform: "rotate(-6deg)" },
            { transform: "rotate(0deg)" },
          ],
          { duration: 650, easing: "ease-in-out", delay: 180 }
        );
        cleanups.push(() => ring.cancel());
      }
      if (fillRef.current) {
        // scaleX, not width: compositor-only, zero layout cost per frame.
        const drain = fillRef.current.animate(
          [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
          { duration: autoDismissMs, easing: "linear", fill: "forwards" }
        );
        cleanups.push(() => drain.cancel());
      }
    }

    return () => cleanups.forEach((fn) => fn());
  }, [activeId, autoDismissMs]);

  /* Escape dismisses — the keyboard exit path the original never had. */
  useEffect(() => {
    if (activeId === undefined || activeId === null) return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeId, onDismiss]);

  if (!notification) return null;

  /* Whole card activates like a button; the close control stays a real
     <button> (buttons cannot nest). Space is bound too — otherwise it
     would scroll the page instead of opening the order. */
  const handleCardKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div style={WRAPPER(narrow)}>
      {/* SR announcement separate from the interactive card — role="alert"
          on the clickable div would override its button semantics. */}
      <span role="status" style={SR_ONLY}>
        New order {notification.id} received
      </span>

      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-label={`New order ${notification.id} received — view active orders`}
        style={cardStyle(hover === "card", narrow)}
        onMouseEnter={() => setHover("card")}
        onMouseLeave={() => setHover((current) => (current === "card" ? null : current))}
        onKeyDown={handleCardKeyDown}
        onClick={onClick}
      >
        <span ref={bellRef} style={MEDALLION} aria-hidden="true">
          <BellRing size={19} strokeWidth={2.1} />
        </span>

        <div style={TEXT}>
          <p style={TITLE}>New Order Received!</p>
          <p style={DETAIL}>
            Order #{notification.id} at {notification.time}
          </p>
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          style={{
            ...CLOSE,
            ...(hover === "close" || hover === "card" ? CLOSE_HOVER : null),
          }}
          onMouseEnter={() => setHover("close")}
          onMouseLeave={() => setHover((current) => (current === "close" ? null : current))}
          onClick={(e) => {
            e.stopPropagation(); // original behavior: dismiss ≠ navigate
            onDismiss();
          }}
        >
          <X size={16} strokeWidth={2.25} aria-hidden="true" />
        </button>

        <span style={PROGRESS_TRACK} aria-hidden="true">
          <span ref={fillRef} style={PROGRESS_FILL} />
        </span>
      </div>
    </div>
  );
}
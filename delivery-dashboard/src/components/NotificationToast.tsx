import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { BellRing, X } from "lucide-react";

interface NotificationInfo {
  id: number | string;
  status: string;
}

interface NotificationToastProps {
  info: NotificationInfo | null;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TRANSITION =
  "background-color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease), color var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease)";

/* Positioning: mirrors the admin app's NewOrderAlert (top-right, below
   the header). Adjust these two constants if your old CSS placed it
   differently. */
const WRAP: CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  zIndex: 1005, // same toast tier as the admin alert — above modals
  display: "flex",
  pointerEvents: "none",
};

const TOAST = (hovered: boolean): CSSProperties => ({
  pointerEvents: "auto",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-16, 16px)",
  width: "min(100vw - 48px, 400px)",
  padding: "var(--bc-space-16, 16px) var(--bc-space-16, 16px) var(--bc-space-16, 16px) var(--bc-space-20, 20px)",
  borderLeft: "4px solid var(--bc-color-brand-action, #d96f2b)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderLeftWidth: 4,
  borderLeftColor: "var(--bc-color-brand-action, #d96f2b)",
  borderRadius: "var(--bc-radius-lg, 12px)",
  backgroundColor: "var(--bc-color-surface-raised, #fff)",
  boxShadow: hovered ? "var(--bc-shadow-hover, 0 16px 40px rgba(43, 35, 28, 0.2))" : "var(--bc-shadow-elevated, 0 12px 32px rgba(43, 35, 28, 0.14))",
  transform: hovered ? "translateY(-4px) scale(1.02)" : "none",
  transition: "transform var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease), box-shadow var(--bc-motion-duration-fast, 120ms) var(--bc-motion-easing-standard, ease)",
});

const MEDALLION: CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 48,
  height: 48,
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: "var(--bc-color-brand-action-soft, #fdf3e8)",
  color: "var(--bc-color-brand-action, #d96f2b)",
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
  letterSpacing: "-0.01em",
  color: "var(--bc-color-text-primary, #2b231c)",
};
const BODY: CSSProperties = {
  margin: 0,
  fontFamily: "var(--bc-login-font-family-mono, 'JetBrains Mono', monospace)",
  fontSize: "0.9375rem",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-muted, #6e6455)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const CLOSE = (hovered: boolean): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 36,
  height: 36,
  padding: 0,
  border: 0,
  borderRadius: "var(--bc-radius-sm, 6px)",
  backgroundColor: hovered ? "var(--bc-color-neutral-bg, #f4f1ea)" : "transparent",
  color: hovered ? "var(--bc-color-text-primary, #2b231c)" : "var(--bc-color-text-muted, #6e6455)",
  cursor: "pointer",
  transition: TRANSITION,
});

/* ------------------------------------------------------------------ */

/**
 * Transient toast for realtime order-update events received over the
 * kitchen WebSocket (see modules/orders/useOrders).
 */
export default function NotificationToast({ info, onClose }: NotificationToastProps) {
  const toastRef = useRef<HTMLDivElement>(null);
  const [hoverClose, setHoverClose] = useState(false);
  const [hoverToast, setHoverToast] = useState(false);

  /* Slide-in per notification — re-runs when the next update arrives */
  useEffect(() => {
    if (!info || REDUCED_MOTION || !toastRef.current) return;
    const animation = toastRef.current.animate(
      [{ opacity: 0, transform: "translateY(-10px)" }, { opacity: 1, transform: "none" }],
      { duration: 280, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, [info]);

  if (!info) return null;

  return (
    <div style={WRAP}>
      {/* role="status" lives on the toast itself — it's non-interactive
          announcement content; the close button stays a real button */}
      <div
        ref={toastRef}
        role="status"
        style={TOAST(hoverToast)}
        onMouseEnter={() => setHoverToast(true)}
        onMouseLeave={() => setHoverToast(false)}
      >
        <span style={MEDALLION} aria-hidden="true">
          <BellRing size={18} strokeWidth={2.1} />
        </span>

        <div style={TEXT}>
          <p style={TITLE}>Update Received!</p>
          <p style={BODY}>
            Order #{info.id} is {info.status}
          </p>
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          style={CLOSE(hoverClose)}
          onMouseEnter={() => setHoverClose(true)}
          onMouseLeave={() => setHoverClose(false)}
          onClick={onClose}
        >
          <X size={15} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
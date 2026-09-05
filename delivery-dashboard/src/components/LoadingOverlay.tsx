import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

/**
 * Full-screen "processing" overlay shown while a status-update request
 * is in flight (mark ready / hand over / etc).
 *
 * The spinner is the RouteMark's dashed route, rotating — the delivery
 * identity doing the one job a spinner has.
 */
export default function LoadingOverlay() {
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);

  const REDUCED_MOTION =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (REDUCED_MOTION) return;
    const cleanups: Array<() => void> = [];

    if (rootRef.current) {
      const fade = rootRef.current.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 160,
        easing: "ease-out",
      });
      cleanups.push(() => fade.cancel());
    }
    if (ringRef.current) {
      const spin = ringRef.current.animate(
        [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
        { duration: 1100, iterations: Infinity, easing: "linear" }
      );
      cleanups.push(() => spin.cancel());
    }

    return () => cleanups.forEach((fn) => fn());
  }, [REDUCED_MOTION]);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      style={OVERLAY}
    >
      <div style={STACK}>
        <div style={RING_BOX} aria-hidden="true">
          {/* Dashed route circle — the marching-dashes motif, circular */}
          <svg ref={ringRef} viewBox="0 0 64 64" width={64} height={64} fill="none" style={{ display: "block" }}>
            <circle
              cx={32}
              cy={32}
              r={28}
              stroke="var(--bc-dlv-color-accent, #d98e3b)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="2.5 7.5"
            />
          </svg>
          {/* The pickup node, waiting at center */}
          <span style={CENTER_DOT} />
        </div>
        <p style={LABEL}>Processing...</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

/* z-tier note: sits ABOVE everything in this portal — scanner (200),
   receipt (1000), toast (1005), verification sheet (1100) — because a
   request in flight must block every one of those surfaces. */
const OVERLAY: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1200,
  display: "grid",
  placeItems: "center",
  background: "var(--bc-color-surface-overlay, rgba(43, 35, 28, 0.5))",
  backdropFilter: "blur(3px)",
  WebkitBackdropFilter: "blur(3px)",
  fontFamily: "var(--bc-font-family, inherit)",
};

const STACK: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-16, 16px)",
};

const RING_BOX: CSSProperties = {
  position: "relative",
  width: 64,
  height: 64,
};

const CENTER_DOT: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 10,
  height: 10,
  borderRadius: "var(--bc-radius-round, 50%)",
  backgroundColor: "var(--bc-dlv-color-accent, #d98e3b)",
};

const LABEL: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  fontWeight: 500,
  /* On the dark scrim, inverse text; the token chain keeps it legible
     over any content underneath. */
  color: "var(--bc-color-text-inverse, #fffdf9)",
  letterSpacing: "0.02em",
};
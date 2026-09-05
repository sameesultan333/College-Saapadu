import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { CheckCircle2, ScanLine, X } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";

import { apiFetch } from "../../services/apiClient";
import { DeliveryOrder } from "../orders/OrdersSection";

interface QRScannerProps {
  selectedOrder: DeliveryOrder | null;
  onVerified: (order: DeliveryOrder) => void;
  onClose: () => void;
}

type ScannerState = "idle" | "success" | "error";

/* ------------------------------------------------------------------ */
/* Motion / reduced-motion guard (WAAPI needs its own; the theme's     */
/* global rule only reaches CSS animations)                            */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* State palette — brackets, dots, HUD. Amber = scanning (delivery     */
/* accent), teal = verified (the RouteMark handoff pin), red = reject. */
/* ------------------------------------------------------------------ */

const STATE_COLOR: Record<ScannerState, string> = {
  idle: "var(--bc-dlv-color-accent, #d98e3b)",
  success: "var(--bc-dlv-color-accent-2, #4c8f7a)",
  error: "var(--bc-color-danger, #b23b2e)",
};

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

/* Fullscreen viewfinder — near-black camera chrome; the feed IS the
   screen. Clicking it does not close (explicit Cancel only). */
const OVERLAY: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200, // original stacking preserved
  background: "var(--bc-dlv-color-bg, #0e1417)",
  overflow: "hidden",
  fontFamily: "var(--bc-font-family, inherit)",
};

const VIDEO: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

/* Reticle: corner brackets + scan window. The huge spread box-shadow
   dims everything OUTSIDE the window — an inline-style-safe cutout. */
const RETICLE: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(76vw, 320px)",
  aspectRatio: 1,
  zIndex: 1,
  pointerEvents: "none",
  boxShadow: "0 0 0 9999px rgba(10, 14, 16, 0.62)",
};

const bracket = (corner: "tl" | "tr" | "bl" | "br", color: string): CSSProperties => {
  const base: CSSProperties = {
    position: "absolute",
    width: 36,
    height: 36,
    transition: "border-color var(--bc-motion-duration-normal, 200ms) var(--bc-motion-easing-standard, ease)",
  };
  switch (corner) {
    case "tl": return { ...base, top: -3, left: -3, borderTop: `3.5px solid ${color}`, borderLeft: `3.5px solid ${color}`, borderTopLeftRadius: 12 };
    case "tr": return { ...base, top: -3, right: -3, borderTop: `3.5px solid ${color}`, borderRight: `3.5px solid ${color}`, borderTopRightRadius: 12 };
    case "bl": return { ...base, bottom: -3, left: -3, borderBottom: `3.5px solid ${color}`, borderLeft: `3.5px solid ${color}`, borderBottomLeftRadius: 12 };
    case "br": return { ...base, bottom: -3, right: -3, borderBottom: `3.5px solid ${color}`, borderRight: `3.5px solid ${color}`, borderBottomRightRadius: 12 };
  }
};

const SCAN_LINE: CSSProperties = {
  position: "absolute",
  left: 10,
  right: 10,
  top: 0,
  height: 2.5,
  borderRadius: "var(--bc-radius-pill, 999px)",
  background: "linear-gradient(90deg, transparent, var(--bc-dlv-color-accent, #d98e3b), transparent)",
  boxShadow: "0 0 12px rgba(217, 142, 59, 0.55)",
};

const CHECK_MEDALLION: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  display: "grid",
  placeItems: "center",
  width: 72,
  height: 72,
  borderRadius: "var(--bc-radius-round, 50%)",
  backgroundColor: "rgba(76, 143, 122, 0.16)",
  border: "2.5px solid var(--bc-dlv-color-accent-2, #4c8f7a)",
  color: "var(--bc-dlv-color-accent-2, #4c8f7a)",
};

/* HUD bars — above the dim layer */
const TOP_BAR: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 2,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "var(--bc-space-12, 12px)",
  padding: "calc(var(--bc-space-16, 16px) + env(safe-area-inset-top)) var(--bc-space-16, 16px) var(--bc-space-12, 12px)",
};

const CONTEXT_CHIP: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 3,
  padding: "10px 14px",
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: "rgba(14, 20, 23, 0.78)",
  border: "1px solid var(--bc-dlv-color-border, rgba(244, 241, 234, 0.1))",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};
const CONTEXT_EYEBROW: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--bc-dlv-color-text-muted, rgba(244, 241, 234, 0.62))",
};
const CONTEXT_ORDER: CSSProperties = {
  margin: 0,
  fontFamily: "var(--bc-login-font-family-mono, 'JetBrains Mono', monospace)",
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-dlv-color-text, #f4f1ea)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const CLOSE_BUTTON: CSSProperties = {
  flex: "none",
  display: "grid",
  placeItems: "center",
  width: 44,
  height: 44,
  padding: 0,
  border: "1px solid var(--bc-dlv-color-border, rgba(244, 241, 234, 0.1))",
  borderRadius: "var(--bc-radius-round, 50%)",
  backgroundColor: "rgba(14, 20, 23, 0.78)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: "var(--bc-dlv-color-text, #f4f1ea)",
  cursor: "pointer",
};

const BOTTOM_BAR: CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 2,
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-12, 12px)",
  padding: "var(--bc-space-16, 16px) var(--bc-space-16, 16px) calc(var(--bc-space-20, 20px) + env(safe-area-inset-bottom))",
};

/* Status HUD chip */
const statusChip = (state: ScannerState): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--bc-space-8, 8px)",
  maxWidth: "min(100%, 420px)",
  padding: "11px 18px",
  borderRadius: "var(--bc-radius-pill, 999px)",
  backgroundColor: "rgba(14, 20, 23, 0.82)",
  border: `1px solid ${STATE_COLOR[state]}`,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  boxShadow: state === "success" ? "0 0 0 4px rgba(76, 143, 122, 0.18)" : state === "error" ? "0 0 0 4px rgba(178, 59, 46, 0.16)" : undefined,
});
const STATUS_DOT: CSSProperties = {
  flex: "none",
  width: 8,
  height: 8,
  borderRadius: "var(--bc-radius-round, 50%)",
  backgroundColor: "currentColor",
};
const STATUS_TEXT: CSSProperties = {
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  fontWeight: 600,
  color: "var(--bc-dlv-color-text, #f4f1ea)",
  textAlign: "center",
};

const CANCEL_BUTTON: CSSProperties = {
  width: "min(100%, 320px)",
  minHeight: 48,
  border: "1px solid var(--bc-dlv-color-border, rgba(244, 241, 234, 0.1))",
  borderRadius: "var(--bc-radius-md, 8px)",
  backgroundColor: "rgba(14, 20, 23, 0.78)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: "var(--bc-dlv-color-text, #f4f1ea)",
  fontSize: "var(--bc-font-size-body, 0.9375rem)",
  fontWeight: 600,
  cursor: "pointer",
};

/* ------------------------------------------------------------------ */
/* Scanner                                                             */
/* ------------------------------------------------------------------ */

export default function QRScanner({ selectedOrder, onVerified, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const scannedRef = useRef(false);
  const scanLineRef = useRef<HTMLSpanElement>(null);

  const [status, setStatus] = useState("Align QR inside frame");
  const [state, setState] = useState<ScannerState>("idle");

  /* Scanning sweep — runs only while idle; stops on success/error.
     This is the one place a scan animation is functional, not decorative. */
  useEffect(() => {
    if (state !== "idle" || REDUCED_MOTION || !scanLineRef.current) return;
    const animation = scanLineRef.current.animate(
      [{ transform: "translateY(6px)" }, { transform: "translateY(calc(min(76vw, 320px) - 12px))" }],
      { duration: 2100, iterations: Infinity, direction: "alternate", easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, [state]);

  /* Escape closes — keyboard exit path */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanner = () => {
    try {
      controlsRef.current?.stop();
    } catch {}

    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    controlsRef.current = null;
  };

  useEffect(() => {
    if (!selectedOrder) return;

    const reader = new BrowserMultiFormatReader();

    const start = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const preferredDevice =
          devices.find((device) => /back|rear|environment/i.test(device.label)) ||
          devices[devices.length - 1] ||
          devices[0];
        const camId = preferredDevice?.deviceId;

        if (!camId) {
          setStatus("No camera found");
          return;
        }

        const videoElement = videoRef.current;
        if (!videoElement) {
          setStatus("Camera unavailable or permission denied");
          return;
        }

        setStatus("Scanning QR...");

        const resultOrPromise = reader.decodeFromVideoDevice(
          camId,
          videoElement,
          async (result) => {
            if (!result || scannedRef.current) return;
            scannedRef.current = true;

            // The scanner does NOT decide anything. It posts exactly what
            // the camera decoded and lets the backend rule on validity:
            // token existence, tenant scope, order state and single-use
            // replay are all enforced server-side.
            //
            // (The previous version parsed the payload looking for an
            // order_id and compared it client-side. Walk-in QRs carry an
            // opaque token, not an order_id, so they could never match --
            // that was the "wrong/failing QR" bug.)
            try {
              const rawText = result.getText();
              setStatus("Verifying with server...");

              const res = await apiFetch("/verification/scan", {
                method: "POST",
                body: JSON.stringify({ payload: rawText }),
              });
              const data = await res.json().catch(() => null);

              if (!res.ok) {
                const detail = data?.detail;
                setState("error");
                setStatus(
                  typeof detail === "string"
                    ? detail
                    : detail?.message || "QR rejected"
                );
                setTimeout(() => {
                  scannedRef.current = false;
                  setState("idle");
                  setStatus("Scanning QR...");
                }, 2200);
                return;
              }

              // Backend resolved the QR to a specific order. If the
              // courier had a different order open, trust the backend's
              // answer over the UI selection.
              const verifiedId = Number(data?.order_id);
              setState("success");
              setStatus(`Verified — Order #${verifiedId}`);
              stopScanner();

              const target =
                selectedOrder && Number(selectedOrder.order_id) === verifiedId
                  ? selectedOrder
                  : ({ ...(selectedOrder as DeliveryOrder), order_id: verifiedId } as DeliveryOrder);

              setTimeout(() => onVerified(target), 700);
            } catch (err) {
              setState("error");
              setStatus("Could not reach the server to verify");
              setTimeout(() => {
                scannedRef.current = false;
                setState("idle");
                setStatus("Scanning QR...");
              }, 2200);
            }
          }
        );

        if (resultOrPromise && typeof resultOrPromise.then === "function") {
          resultOrPromise.then((controls: { stop: () => void }) => {
            controlsRef.current = controls;
          }).catch(e => console.error("Scanner Error:", e));
        } else {
          controlsRef.current = resultOrPromise as unknown as { stop: () => void };
        }
      } catch {
        setStatus("Camera unavailable or permission denied");
      }
    };

    start();

    return () => {
      stopScanner();
      scannedRef.current = false;
    };
  }, [selectedOrder, onVerified]);

  const close = () => {
    stopScanner();
    if (typeof onClose === "function") onClose();
  };

  const color = STATE_COLOR[state];

  return (
    <div style={OVERLAY} role="dialog" aria-modal="true" aria-label="Verify pickup by scanning student QR">
      {/* Feed — full-bleed behind everything */}
      <video ref={videoRef} autoPlay playsInline muted style={VIDEO} />

      {/* Reticle + dim-cutout layer */}
      <div style={RETICLE} aria-hidden="true">
        <span style={bracket("tl", color)} />
        <span style={bracket("tr", color)} />
        <span style={bracket("bl", color)} />
        <span style={bracket("br", color)} />
        {state === "idle" && <span ref={scanLineRef} style={SCAN_LINE} />}
        {state === "success" && (
          <span style={CHECK_MEDALLION}>
            <CheckCircle2 size={34} strokeWidth={2.25} />
          </span>
        )}
      </div>

      {/* Context HUD */}
      <div style={TOP_BAR}>
        <div style={CONTEXT_CHIP}>
          <p style={CONTEXT_EYEBROW}>Verify Pickup</p>
          <p style={CONTEXT_ORDER}>
            #{selectedOrder?.order_id}
            {selectedOrder?.canteen_name ? ` · ${selectedOrder.canteen_name}` : ""}
          </p>
        </div>
        <button type="button" style={CLOSE_BUTTON} onClick={close} aria-label="Close scanner">
          <X size={19} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>

      {/* Status + cancel */}
      <div style={BOTTOM_BAR}>
        <div style={statusChip(state)} role="status" aria-live="polite">
          <span style={{ ...STATUS_DOT, color }}>
            {state === "idle" && (
              <ScanLine
                size={16}
                strokeWidth={2.25}
                style={{ position: "absolute", transform: "translate(-4px, -4px)", color: "transparent" }}
                aria-hidden="true"
              />
            )}
          </span>
          <span style={STATUS_TEXT}>{status}</span>
        </div>
        <button type="button" style={CANCEL_BUTTON} onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}
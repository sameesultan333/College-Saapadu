import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactElement } from "react";
import { CircleAlert, Loader2, MapPin } from "lucide-react";

import Modal, { modalStyles } from "../../components/Modal/Modal";
import { Canteen, updateCanteen, toggleCanteen } from "./canteenService";

interface EditCanteenModalProps {
  canteen: Canteen;
  onClose: () => void;
  onUpdated: (canteen: Canteen) => void;
}

/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const TRANSITION =
  "border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), box-shadow var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)";

const BODY: CSSProperties = {
  ...modalStyles.body,
  display: "grid",
  gap: "var(--bc-space-16)",
};

const GROUP: CSSProperties = { display: "grid", gap: "var(--bc-space-8)", minWidth: 0 };

const LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  color: "var(--bc-color-text-secondary)",
};
const LABEL_MUTED: CSSProperties = { fontWeight: 400, color: "var(--bc-color-text-muted)" };

const INPUT: CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "0 var(--bc-space-12)",
  border: "1px solid var(--bc-color-border-default)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-surface-raised)",
  font: "inherit",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-primary)",
  transition: TRANSITION,
};
const INPUT_FOCUSED: CSSProperties = {
  outline: "none",
  borderColor: "var(--bc-color-brand-primary)",
  boxShadow: "var(--bc-focus-ring, 0 0 0 3px rgba(30, 59, 43, 0.14))",
};

/* Row of two time fields — minmax(0,·) so narrow viewports can't blow out */
const ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: "var(--bc-space-16)",
  alignItems: "start",
};

/* Location pin — same treatment as AddCanteenModal */
const AFFIX_WRAP: CSSProperties = { position: "relative" };
const AFFIX_ICON: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "var(--bc-space-12)",
  transform: "translateY(-50%)",
  color: "var(--bc-color-text-muted)",
  pointerEvents: "none",
};
const LOCATION_INPUT: CSSProperties = { ...INPUT, paddingLeft: "2.5rem" };

/* Status strip — the operational heart of this modal */
const STATUS_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--bc-space-12)",
  padding: "var(--bc-space-12) var(--bc-space-16)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-surface-page-alt)",
};
const STATUS_LEFT: CSSProperties = { display: "flex", alignItems: "center", gap: "var(--bc-space-8)", minWidth: 0 };
const STATUS_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
};

const statusDot = (active: boolean): CSSProperties => ({
  flex: "none",
  width: 8,
  height: 8,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: active ? "var(--bc-color-success)" : "var(--bc-color-text-faint)",
  boxShadow: active ? "0 0 0 3px var(--bc-color-success-bg)" : "0 0 0 3px var(--bc-color-neutral-bg)",
});

/* State-changing action: tinted, not solid — Close reads as consequential
   (danger tint), Reopen as restorative (success tint). */
const toggleButton = (active: boolean, hovered: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 38,
  padding: "0 var(--bc-space-16)",
  border: `1px solid ${active ? "var(--bc-color-danger-border)" : "var(--bc-color-success-border)"}`,
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: active
    ? hovered
      ? "var(--bc-color-danger-bg)"
      : "transparent"
    : hovered
      ? "var(--bc-color-success-bg)"
      : "transparent",
  color: active ? "var(--bc-color-danger)" : "var(--bc-color-success-strong)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});
const TOGGLE_DISABLED: CSSProperties = { opacity: 0.55, cursor: "default" };

const ERROR: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-8)",
  margin: 0,
  padding: "var(--bc-space-8) var(--bc-space-12)",
  border: "1px solid var(--bc-color-danger-border)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-danger-bg)",
  color: "var(--bc-color-danger)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
};
const ERROR_ICON: CSSProperties = { flex: "none", marginTop: 1 };

const SUBMIT_LABEL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--bc-space-8)",
};

/* ------------------------------------------------------------------ */
/* Time format helpers                                                 */
/* ------------------------------------------------------------------ */

// HTML <input type="time"> gives/wants "HH:MM"; the backend stores/returns
// a Python time, serialized as "HH:MM:SS". Trim to minutes for the input,
// pad back to seconds when sending (Python's time.fromisoformat is strict
// about the format on older versions).
function toInputTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}
function toApiTime(value: string): string | null {
  return value ? `${value}:00` : null;
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export default function EditCanteenModal({ canteen, onClose, onUpdated }: EditCanteenModalProps) {
  const [name, setName] = useState(canteen.name);
  const [location, setLocation] = useState(canteen.location || "");
  const [opensAt, setOpensAt] = useState(toInputTime(canteen.opens_at));
  const [closesAt, setClosesAt] = useState(toInputTime(canteen.closes_at));
  const [isActive, setIsActive] = useState(canteen.is_active);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // placeholder removed — see note
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoverToggle, setHoverToggle] = useState(false);

  // (no password state belongs here — that line above is removed below)
  void showPassword;

  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !bodyRef.current) return;
    const animation = bodyRef.current.animate(
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: 240, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a canteen name");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const updated = await updateCanteen(canteen.id, {
        name: name.trim(),
        location: location.trim(),
        opens_at: toApiTime(opensAt),
        closes_at: toApiTime(closesAt),
      });
      onUpdated({ ...updated, is_active: isActive });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update canteen");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async () => {
    setTogglingStatus(true);
    setError("");
    try {
      const updated = await toggleCanteen(canteen.id);
      setIsActive(updated.is_active);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change canteen status");
    } finally {
      setTogglingStatus(false);
    }
  };

  const inputStyle = (field: string): CSSProperties => ({
    ...(field === "location" ? LOCATION_INPUT : INPUT),
    ...(focusedField === field ? INPUT_FOCUSED : null),
  });

  return (
    <Modal title="Edit Canteen" onClose={onClose}>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div ref={bodyRef} style={BODY}>
          {/* Status strip */}
          <div style={STATUS_ROW}>
            <div style={STATUS_LEFT}>
              <span style={statusDot(isActive)} aria-hidden="true" />
              <span style={STATUS_LABEL} aria-live="polite">
                {isActive ? "Currently Open" : "Currently Closed"}
              </span>
            </div>
            <button
              type="button"
              style={{
                ...toggleButton(isActive, hoverToggle),
                ...(togglingStatus ? TOGGLE_DISABLED : null),
              }}
              disabled={togglingStatus}
              onMouseEnter={() => setHoverToggle(true)}
              onMouseLeave={() => setHoverToggle(false)}
              onClick={handleToggle}
            >
              {togglingStatus && (
                <Spin>
                  <Loader2 size={14} strokeWidth={2.5} aria-hidden="true" />
                </Spin>
              )}
              {togglingStatus ? "Updating..." : isActive ? "Close Canteen" : "Reopen Canteen"}
            </button>
          </div>

          <div style={GROUP}>
            <label htmlFor="edit-canteen-name" style={LABEL}>
              Canteen name
            </label>
            <input
              id="edit-canteen-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              aria-invalid={error ? true : undefined}
              style={inputStyle("name")}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
            />
          </div>

          <div style={GROUP}>
            <label htmlFor="edit-canteen-location" style={LABEL}>
              Location <span style={LABEL_MUTED}>(optional)</span>
            </label>
            <div style={AFFIX_WRAP}>
              <MapPin size={15} strokeWidth={2} style={AFFIX_ICON} aria-hidden="true" />
              <input
                id="edit-canteen-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={inputStyle("location")}
                onFocus={() => setFocusedField("location")}
                onBlur={() => setFocusedField(null)}
              />
            </div>
          </div>

          <div style={ROW}>
            <div style={GROUP}>
              <label htmlFor="edit-canteen-opens" style={LABEL}>
                Opens at
              </label>
              <input
                id="edit-canteen-opens"
                type="time"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                style={inputStyle("opens")}
                onFocus={() => setFocusedField("opens")}
                onBlur={() => setFocusedField(null)}
              />
            </div>
            <div style={GROUP}>
              <label htmlFor="edit-canteen-closes" style={LABEL}>
                Closes at
              </label>
              <input
                id="edit-canteen-closes"
                type="time"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                style={inputStyle("closes")}
                onFocus={() => setFocusedField("closes")}
                onBlur={() => setFocusedField(null)}
              />
            </div>
          </div>

          {error && (
            <p style={ERROR} role="alert">
              <CircleAlert size={15} strokeWidth={2.25} style={ERROR_ICON} aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <div style={modalStyles.footer}>
          <button type="button" style={modalStyles.secondaryButton} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" style={modalStyles.primaryButton} disabled={submitting}>
            <span style={SUBMIT_LABEL}>
              {submitting && (
                <Spin>
                  <Loader2 size={15} strokeWidth={2.5} aria-hidden="true" />
                </Spin>
              )}
              {submitting ? "Saving..." : "Save Changes"}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
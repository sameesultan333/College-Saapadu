import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactElement } from "react";
import { CircleAlert, Loader2, MapPin } from "lucide-react";

import Modal, { modalStyles } from "../../components/Modal/Modal";
import { createCanteen } from "./canteenService";

interface AddCanteenModalProps {
  onClose: () => void;
  onCreated: () => void;
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

/* Location gets a quiet pin — the one field that's about a place */
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
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export default function AddCanteenModal({ onClose, onCreated }: AddCanteenModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<"name" | "location" | null>(null);

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
      await createCanteen(name.trim(), location.trim());
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create canteen");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (field: "name" | "location"): CSSProperties => ({
    ...(field === "location" ? LOCATION_INPUT : INPUT),
    ...(focusedField === field ? INPUT_FOCUSED : null),
  });

  return (
    <Modal title="Add New Canteen" onClose={onClose}>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div ref={bodyRef} style={BODY}>
          <div style={GROUP}>
            <label htmlFor="add-canteen-name" style={LABEL}>
              Canteen name
            </label>
            <input
              id="add-canteen-name"
              type="text"
              required
              placeholder="e.g. Main Canteen"
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
            <label htmlFor="add-canteen-location" style={LABEL}>
              Location <span style={{ fontWeight: 400, color: "var(--bc-color-text-muted)" }}>(optional)</span>
            </label>
            <div style={AFFIX_WRAP}>
              <MapPin size={15} strokeWidth={2} style={AFFIX_ICON} aria-hidden="true" />
              <input
                id="add-canteen-location"
                type="text"
                placeholder="e.g. Block A, Ground Floor"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={inputStyle("location")}
                onFocus={() => setFocusedField("location")}
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
              {submitting ? "Creating..." : "Add Canteen"}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { CircleAlert, GraduationCap, Loader2, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import Modal, { modalStyles } from "../../components/Modal/Modal";
import { createGuest, Guest, GuestCategory } from "../guests/guestService";

interface GuestDetailsModalProps {
  onClose: () => void;
  onCreated: (guest: Guest) => void;
}

/* ------------------------------------------------------------------ */
/* Motion guard — the theme's global reduced-motion rule doesn't reach
   WAAPI, so effects need their own check.                              */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const BODY: CSSProperties = {
  ...modalStyles.body,
  display: "grid",
  gap: "var(--bc-space-16)",
};

const INTRO: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-8)",
  margin: 0,
  padding: "var(--bc-space-8) var(--bc-space-12)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-surface-page-alt)",
  fontSize: "var(--bc-font-size-secondary)",
  lineHeight: "var(--bc-line-height-normal)",
  color: "var(--bc-color-text-muted)",
};
const INTRO_ICON: CSSProperties = {
  flex: "none",
  marginTop: 1,
  color: "var(--bc-color-brand-primary)",
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
  transition:
    "border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), box-shadow var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
};

/* Inline replacement for :focus — ring in the brand focus token */
const INPUT_FOCUSED: CSSProperties = {
  outline: "none",
  borderColor: "var(--bc-color-brand-primary)",
  boxShadow: "var(--bc-focus-ring)",
};

/* Invalid ring only while the server error is showing */
const INPUT_INVALID: CSSProperties = {
  borderColor: "var(--bc-color-danger)",
};

const HINT: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-caption)",
  color: "var(--bc-color-text-muted)",
};

const ERROR: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-8)",
  margin: 0,
  padding: "var(--bc-space-8) var(--bc-space-12)",
  border: "1px solid var(--bc-color-danger-border)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-danger-bg)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  color: "var(--bc-color-danger)",
};

const SUBMIT_LABEL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--bc-space-8)",
};

const SPIN: CSSProperties = { animation: "gm-spin 0.9s linear infinite" };

/* ------------------------------------------------------------------ */
/* Category selector — who the walk-in customer is. Self-declared,     */
/* informational only: it drives the kitchen/delivery order card's     */
/* label ("Student"/"Parent"/"Staff") instead of a hardcoded guess.     */
/* ------------------------------------------------------------------ */

const CATEGORY_ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "var(--bc-space-8)",
};

const categoryOption = (active: boolean): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "var(--bc-space-8) var(--bc-space-4)",
  border: `1.5px solid ${active ? "var(--bc-color-brand-primary)" : "var(--bc-color-border-default)"}`,
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: active ? "var(--bc-color-brand-primary-faint)" : "var(--bc-color-surface-raised)",
  color: active ? "var(--bc-color-brand-primary)" : "var(--bc-color-text-secondary)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

interface CategoryMeta {
  value: GuestCategory;
  label: string;
  icon: LucideIcon;
}

const CATEGORY_OPTIONS: CategoryMeta[] = [
  { value: "STUDENT", label: "Student", icon: GraduationCap },
  { value: "PARENT", label: "Parent", icon: Users },
  { value: "STAFF", label: "Staff", icon: UserRound },
];

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

// Walk-in customer entry point: "Enter Name + Phone -> Create Guest
// Customer" from the walk-in flow. Shown before payment so every counter
// order gets a real guest identity instead of a hardcoded/fake user_id.
export default function GuestDetailsModal({ onClose, onCreated }: GuestDetailsModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<GuestCategory>("STUDENT");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<"name" | "phone" | null>(null);

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
    setError("");
    setSubmitting(true);
    try {
      const guest = await createGuest(name.trim(), phone.trim(), category);
      onCreated(guest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create guest");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (field: "name" | "phone"): CSSProperties => ({
    ...INPUT,
    ...(focusedField === field ? INPUT_FOCUSED : null),
    ...(error ? INPUT_INVALID : null),
  });

  return (
    <Modal title="Walk-in Customer" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate={false} autoComplete="off">
        <div ref={bodyRef} style={BODY}>
          <p style={INTRO}>
            <UserRound size={15} strokeWidth={2.25} style={INTRO_ICON} aria-hidden="true" />
            <span>Enter the customer&apos;s name and phone number to start this order.</span>
          </p>

          <div style={GROUP}>
            <label htmlFor="guest-name" style={LABEL}>
              Name
            </label>
            <input
              id="guest-name"
              style={inputStyle("name")}
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. Ananya Rao"
              value={name}
              autoFocus
              aria-invalid={error ? true : undefined}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
            />
          </div>

          <div style={GROUP}>
            <label htmlFor="guest-phone" style={LABEL}>
              Phone number
            </label>
            <input
              id="guest-phone"
              style={inputStyle("phone")}
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={phone}
              aria-invalid={error ? true : undefined}
              aria-describedby="guest-phone-hint"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onFocus={() => setFocusedField("phone")}
              onBlur={() => setFocusedField(null)}
            />
            <p id="guest-phone-hint" style={HINT}>
              Used to identify this order at pickup.
            </p>
          </div>

          <div style={GROUP}>
            <label style={LABEL} id="guest-category-label">
              Who is this?
            </label>
            <div style={CATEGORY_ROW} role="radiogroup" aria-labelledby="guest-category-label">
              {CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={category === value}
                  style={categoryOption(category === value)}
                  onClick={() => setCategory(value)}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={ERROR} role="alert">
              <CircleAlert size={15} strokeWidth={2.25} aria-hidden="true" />
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
                <Loader2 size={15} strokeWidth={2.5} style={SPIN} aria-hidden="true" />
              )}
              {submitting ? "Creating..." : "Continue"}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
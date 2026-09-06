import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactElement } from "react";
import { ChevronDown, CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";

import Modal, { modalStyles } from "../../components/Modal/Modal";
import { Canteen } from "../canteens/canteenService";
import { createStaff, StaffRole } from "./staffService";

interface AddStaffModalProps {
  canteens: Canteen[];
  defaultCanteenId?: number;
  defaultRole?: StaffRole;
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

const PASSWORD_WRAP: CSSProperties = { position: "relative" };

const SELECT_WRAP: CSSProperties = {
  position: "relative",
  minWidth: 0,
};

const SELECT: CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: "2.75rem",
  cursor: "pointer",
};

const SELECT_ICON: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: "var(--bc-space-12)",
  transform: "translateY(-50%)",
  color: "var(--bc-color-text-muted)",
  pointerEvents: "none",
};

/* The eye toggle — clears the input's text with its own padding */
const TOGGLE = (accent: boolean): CSSProperties => ({
  position: "absolute",
  top: "50%",
  right: "0.375rem",
  transform: "translateY(-50%)",
  display: "grid",
  placeItems: "center",
  width: 38,
  height: 38,
  border: 0,
  borderRadius: "var(--bc-radius-sm)",
  background: "transparent",
  color: accent ? "var(--bc-color-brand-primary)" : "var(--bc-color-text-muted)",
  cursor: "pointer",
  transition: "color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

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

export default function AddStaffModal({
  canteens,
  defaultCanteenId,
  defaultRole = "staff",
  onClose,
  onCreated,
}: AddStaffModalProps) {
  const [name, setName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const role = defaultRole;
  const [canteenId, setCanteenId] = useState(
    defaultCanteenId ? String(defaultCanteenId) : canteens[0] ? String(canteens[0].id) : ""
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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

    if (!canteenId) {
      setError("Please select a canteen");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await createStaff({
        name: name.trim(),
        staff_id: staffId.trim(),
        phone: phone.trim(),
        password,
        confirm_password: confirmPassword,
        canteen_id: Number(canteenId),
        role,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create staff account");
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = role === "delivery" ? "Add Delivery Account" : "Add Staff Account";

  const inputStyle = (field: string): CSSProperties => ({
    ...INPUT,
    ...(focusedField === field ? INPUT_FOCUSED : null),
  });

  const passwordInputStyle = (field: string): CSSProperties => ({
    ...inputStyle(field),
    paddingRight: "3rem",
  });

  const eyeButton = (ariaLabel: string): ReactElement => (
    <button
      type="button" // critical: a submit-context button must never submit
      aria-label={ariaLabel}
      aria-pressed={showPassword}
      style={TOGGLE(
        showPassword || focusedField === "password" || focusedField === "confirm"
      )}
      onFocus={() => setFocusedField("toggle")}
      onBlur={() => setFocusedField(null)}
      onClick={() => setShowPassword((current) => !current)}
    >
      {showPassword ? (
        <EyeOff size={17} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Eye size={17} strokeWidth={2} aria-hidden="true" />
      )}
    </button>
  );

  return (
    <Modal title={modalTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div ref={bodyRef} style={BODY}>
          <div style={GROUP}>
            <label htmlFor="add-staff-name" style={LABEL}>
              Name
            </label>
            <input
              id="add-staff-name"
              style={inputStyle("name")}
              type="text"
              required
              autoComplete="name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
            />
          </div>

          <div style={GROUP}>
            <label htmlFor="add-staff-id" style={LABEL}>
              Staff ID
            </label>
            <input
              id="add-staff-id"
              style={inputStyle("staffId")}
              type="text"
              required
              autoComplete="off"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              onFocus={() => setFocusedField("staffId")}
              onBlur={() => setFocusedField(null)}
            />
          </div>

          <div style={GROUP}>
            <label htmlFor="add-staff-phone" style={LABEL}>
              Phone Number
            </label>
            <input
              id="add-staff-phone"
              style={inputStyle("phone")}
              type="tel"
              inputMode="numeric"
              required
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onFocus={() => setFocusedField("phone")}
              onBlur={() => setFocusedField(null)}
            />
          </div>

          <div style={GROUP}>
            <label htmlFor="add-staff-canteen" style={LABEL}>
              Canteen
            </label>
            <div style={SELECT_WRAP}>
              <select
                id="add-staff-canteen"
                style={{ ...inputStyle("canteen"), ...SELECT }}
                value={canteenId}
                required
                onChange={(e) => setCanteenId(e.target.value)}
                onFocus={() => setFocusedField("canteen")}
                onBlur={() => setFocusedField(null)}
              >
                <option value="" disabled>
                  Select a canteen
                </option>
                {canteens.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} strokeWidth={2.25} style={SELECT_ICON} aria-hidden="true" />
            </div>
          </div>

          <div style={GROUP}>
            <label htmlFor="add-staff-password" style={LABEL}>
              Password
            </label>
            <div style={PASSWORD_WRAP}>
              <input
                id="add-staff-password"
                style={passwordInputStyle("password")}
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
              />
              {eyeButton(showPassword ? "Hide password" : "Show password")}
            </div>
          </div>

          <div style={GROUP}>
            <label htmlFor="add-staff-confirm" style={LABEL}>
              Confirm Password
            </label>
            <div style={PASSWORD_WRAP}>
              <input
                id="add-staff-confirm"
                style={passwordInputStyle("confirm")}
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setFocusedField("confirm")}
                onBlur={() => setFocusedField(null)}
              />
              {eyeButton(showPassword ? "Hide passwords" : "Show passwords")}
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
              {submitting ? "Creating..." : role === "delivery" ? "Add Delivery" : "Add Staff"}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
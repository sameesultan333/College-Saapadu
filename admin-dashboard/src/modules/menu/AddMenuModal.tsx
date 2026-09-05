import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent, FormEvent } from "react";
import { Flame, ImagePlus, Info, Timer, Trash2 } from "lucide-react";

import Modal, { modalStyles } from "../../components/Modal/Modal";

/* Local shape. Every field is the existing contract with AdminDashboard;
   `image` is optional and only staged here — see the integration note in
   this file's PR notes before wiring it into the S3 upload. */
interface NewMenuItem {
  name: string;
  price: string;
  stock: string;
  is_veg: boolean;
  prep_type: string;
  gst_rate: string;
  image?: File | null;
}

interface AddMenuModalProps {
  newItem: NewMenuItem;
  onChange: (item: NewMenuItem) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Photo section switch. Pass false until addMenuItem accepts FormData. */
  enableImage?: boolean;
  /** Wire from the parent once submission is async; disables the footer. */
  submitting?: boolean;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TRANSITION =
  "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)";

const PREP_OPTIONS = [
  { value: "RA", label: "Ready to serve", hint: "Available now · ~1 min", icon: Timer },
  { value: "COOK", label: "Freshly cooked", hint: "Made to order · ~3 mins", icon: Flame },
] as const;

const GST_OPTIONS = [
  { value: "0", label: "0% (exempt)" },
  { value: "5", label: "5%" },
  { value: "7", label: "7%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
] as const;

const formatFileSize = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* ------------------------------------------------------------------ */
/* Responsive hook — the JS replacement for @media                     */
/* ------------------------------------------------------------------ */

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
/* Style factories — standalone (a Record of CSSProperties cannot hold */
/* functions; see the OverviewTab build error for why this matters)    */
/* ------------------------------------------------------------------ */

const foodToggleStyle = (variant: "veg" | "nonveg", active: boolean, hovered: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--bc-space-8)",
  flex: 1,
  minHeight: 42,
  padding: "0 var(--bc-space-12)",
  borderRadius: "var(--bc-radius-md)",
  cursor: "pointer",
  font: "inherit",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  border: `1px solid ${
    active
      ? variant === "veg"
        ? "var(--bc-color-success-border)"
        : "var(--bc-color-danger-border)"
      : hovered
        ? "var(--bc-color-border-strong)"
        : "var(--bc-color-border-default)"
  }`,
  backgroundColor: active
    ? variant === "veg"
      ? "var(--bc-color-surface-veg)"
      : "var(--bc-color-surface-nonveg)"
    : hovered
      ? "var(--bc-color-surface-page-alt)"
      : "var(--bc-color-surface-raised)",
  color: active
    ? variant === "veg"
      ? "var(--bc-color-success-strong)"
      : "var(--bc-color-danger-strong)"
    : "var(--bc-color-text-secondary)",
  transition: TRANSITION,
});

/* FSSAI-style classification mark — same motif as StockCard */
const vegMarkStyle = (isVeg: boolean): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 15,
  height: 15,
  border: `1.5px solid ${isVeg ? "var(--bc-color-success)" : "var(--bc-color-danger)"}`,
  borderRadius: 3,
  backgroundColor: "var(--bc-color-surface-raised)",
});

const vegDotStyle = (isVeg: boolean): CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: isVeg ? "var(--bc-color-success)" : "var(--bc-color-danger)",
});

const prepCardStyle = (active: boolean, hovered: boolean): CSSProperties => ({
  display: "grid",
  gap: 2,
  justifyItems: "start",
  textAlign: "left",
  minHeight: 58,
  padding: "var(--bc-space-8) var(--bc-space-12)",
  borderRadius: "var(--bc-radius-md)",
  cursor: "pointer",
  font: "inherit",
  border: `1px solid ${active ? "var(--bc-color-brand-primary)" : hovered ? "var(--bc-color-border-strong)" : "var(--bc-color-border-default)"}`,
  backgroundColor: active
    ? "var(--bc-color-brand-primary-faint)"
    : hovered
      ? "var(--bc-color-surface-page-alt)"
      : "var(--bc-color-surface-raised)",
  color: active ? "var(--bc-color-brand-primary)" : "var(--bc-color-text-secondary)",
  transition: TRANSITION,
});

const dropzoneStyle = (dragging: boolean, hovered: boolean, focused: boolean): CSSProperties => ({
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-4)",
  padding: "var(--bc-space-24) var(--bc-space-16)",
  border: `1.5px dashed ${
    dragging || hovered || focused
      ? "var(--bc-color-brand-primary-light)"
      : "var(--bc-color-border-strong)"
  }`,
  borderRadius: "var(--bc-radius-lg)",
  backgroundColor: dragging
    ? "var(--bc-color-brand-primary-faint)"
    : hovered
      ? "var(--bc-color-surface-page-alt)"
      : "var(--bc-color-surface-sunken)",
  color: "var(--bc-color-text-secondary)",
  cursor: "pointer",
  textAlign: "center",
  transition: TRANSITION,
});

const replaceStyle = (hovered: boolean): CSSProperties => ({
  border: 0,
  padding: "var(--bc-space-4) var(--bc-space-8)",
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: "transparent",
  color: "var(--bc-color-brand-primary)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: hovered ? "underline" : "none",
});

const removeBtnStyle = (hovered: boolean): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 38,
  height: 38,
  borderRadius: "var(--bc-radius-md)",
  border: "1px solid var(--bc-color-danger-border)",
  backgroundColor: hovered ? "var(--bc-color-danger-bg)" : "transparent",
  color: "var(--bc-color-danger)",
  cursor: "pointer",
  transition: TRANSITION,
});

/* ------------------------------------------------------------------ */
/* Static styles                                                       */
/* ------------------------------------------------------------------ */

const BODY: CSSProperties = {
  ...modalStyles.body,
  display: "grid",
  gap: "var(--bc-space-20)",
};

const ROW_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: "var(--bc-space-16)",
  alignItems: "start",
  minWidth: 0,
};
const ROW_STACK: CSSProperties = { ...ROW_GRID, gridTemplateColumns: "1fr" };
const PREP_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: "var(--bc-space-8)",
};

const GROUP: CSSProperties = { display: "grid", gap: "var(--bc-space-8)", minWidth: 0 };

const LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  color: "var(--bc-color-text-secondary)",
};
const LABEL_ROW: CSSProperties = { display: "flex", alignItems: "baseline", gap: "var(--bc-space-8)" };
const OPTIONAL_TAG: CSSProperties = {
  marginLeft: "auto",
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted)",
};

const INPUT: CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "0 var(--bc-space-12)",
  border: "1px solid var(--bc-color-border-default)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-surface-raised)",
  font: "inherit",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-primary)",
};
const PRICE_INPUT: CSSProperties = { ...INPUT, paddingLeft: 30 };

const AFFIX_WRAP: CSSProperties = { position: "relative" };
const AFFIX: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "var(--bc-space-12)",
  transform: "translateY(-50%)",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  color: "var(--bc-color-text-muted)",
  pointerEvents: "none",
};

const TOGGLE_ROW: CSSProperties = { display: "flex", gap: "var(--bc-space-8)" };

const PREP_TOP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
};
const PREP_HINT: CSSProperties = {
  fontSize: "var(--bc-font-size-caption)",
  color: "var(--bc-color-text-muted)",
};

const NOTE: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-8)",
  minWidth: 0,
  padding: "var(--bc-space-8) var(--bc-space-12)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-surface-page-alt)",
  color: "var(--bc-color-text-muted)",
  fontSize: "var(--bc-font-size-caption)",
  lineHeight: "var(--bc-line-height-normal)",
};
const NOTE_ICON: CSSProperties = {
  flex: "none",
  marginTop: 1,
  color: "var(--bc-color-brand-accent-strong)",
};

const DZ_ICON: CSSProperties = { color: "var(--bc-color-brand-primary)" };
const DZ_TITLE: CSSProperties = {
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
};
const DZ_HINT: CSSProperties = {
  fontSize: "var(--bc-font-size-caption)",
  color: "var(--bc-color-text-muted)",
};

const PREVIEW_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-12)",
};
const THUMB: CSSProperties = {
  width: 56,
  height: 56,
  flex: "none",
  borderRadius: "var(--bc-radius-md)",
  objectFit: "cover",
  border: "1px solid var(--bc-color-border-subtle)",
};
const PREVIEW_META: CSSProperties = { display: "grid", gap: 2, flex: 1, minWidth: 0 };
const PREVIEW_NAME: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const PREVIEW_SIZE: CSSProperties = {
  fontSize: "var(--bc-font-size-caption)",
  color: "var(--bc-color-text-muted)",
};

const ERROR_TEXT: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-caption)",
  fontWeight: 600,
  color: "var(--bc-color-danger)",
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
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export default function AddMenuModal({
  newItem,
  onChange,
  onClose,
  onSubmit,
  enableImage = true,
  submitting = false,
}: AddMenuModalProps) {
  const isNarrow = useMediaQuery("(max-width: 560px)");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dropFocused, setDropFocused] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const file = newItem.image ?? null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object-URL lifecycle is owned here: created per file, revoked on
  // replace/remove/unmount. Parent state only ever holds the File itself.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !bodyRef.current) return;
    const animation = bodyRef.current.animate(
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: 240, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  const hoverProps = (id: string) => ({
    onMouseEnter: () => setHoverId(id),
    onMouseLeave: () => setHoverId((current) => (current === id ? null : current)),
  });

  const acceptFile = (incoming: File): void => {
    if (!incoming.type.startsWith("image/")) {
      setImageError("That file isn't an image — choose a JPG or PNG.");
      return;
    }
    setImageError(null);
    onChange({ ...newItem, image: incoming });
  };

  const removeImage = (): void => {
    setImageError(null);
    onChange({ ...newItem, image: null });
  };

  const rowStyle = isNarrow ? ROW_STACK : ROW_GRID;

  return (
    <Modal title="Add New Menu Item" onClose={onClose} contentClassName="add-menu-modal">
      <form onSubmit={onSubmit} autoComplete="off">
        <div ref={bodyRef} style={BODY}>
          {/* Identity */}
          <div style={GROUP}>
            <label htmlFor="add-menu-name" style={LABEL}>
              Item name
            </label>
            <input
              id="add-menu-name"
              type="text"
              required
              placeholder="e.g. Masala Dosa"
              value={newItem.name}
              style={INPUT}
              onChange={(e) => onChange({ ...newItem, name: e.target.value })}
            />
          </div>

          {/* Pricing & availability */}
          <div style={rowStyle}>
            <div style={GROUP}>
              <label htmlFor="add-menu-price" style={LABEL}>
                Price (₹)
              </label>
              <div style={AFFIX_WRAP}>
                <span style={AFFIX} aria-hidden="true">
                  ₹
                </span>
                <input
                  id="add-menu-price"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={newItem.price}
                  style={PRICE_INPUT}
                  onChange={(e) => onChange({ ...newItem, price: e.target.value })}
                />
              </div>
            </div>

            <div style={GROUP}>
              <label htmlFor="add-menu-stock" style={LABEL}>
                Initial stock
              </label>
              <input
                id="add-menu-stock"
                type="number"
                required
                min="0"
                placeholder="0"
                value={newItem.stock}
                style={INPUT}
                onChange={(e) => onChange({ ...newItem, stock: e.target.value })}
              />
            </div>
          </div>

          {/* Classification & service */}
          <div style={rowStyle}>
            <div style={GROUP}>
              <span id="add-menu-foodtype-label" style={LABEL}>
                Food type
              </span>
              <div style={TOGGLE_ROW} role="group" aria-labelledby="add-menu-foodtype-label">
                <button
                  type="button"
                  aria-pressed={newItem.is_veg}
                  style={foodToggleStyle("veg", newItem.is_veg, hoverId === "veg")}
                  {...hoverProps("veg")}
                  onClick={() => onChange({ ...newItem, is_veg: true })}
                >
                  <span style={vegMarkStyle(true)} aria-hidden="true">
                    <span style={vegDotStyle(true)} />
                  </span>
                  Veg
                </button>
                <button
                  type="button"
                  aria-pressed={!newItem.is_veg}
                  style={foodToggleStyle("nonveg", !newItem.is_veg, hoverId === "nonveg")}
                  {...hoverProps("nonveg")}
                  onClick={() => onChange({ ...newItem, is_veg: false })}
                >
                  <span style={vegMarkStyle(false)} aria-hidden="true">
                    <span style={vegDotStyle(false)} />
                  </span>
                  Non-Veg
                </button>
              </div>
            </div>

            <div style={GROUP}>
              <span id="add-menu-prep-label" style={LABEL}>
                Preparation
              </span>
              <div
                role="group"
                aria-labelledby="add-menu-prep-label"
                style={isNarrow ? ROW_STACK : PREP_GRID}
              >
                {PREP_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
                  const active = newItem.prep_type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      style={prepCardStyle(active, hoverId === value)}
                      {...hoverProps(value)}
                      onClick={() => onChange({ ...newItem, prep_type: value })}
                    >
                      <span style={PREP_TOP}>
                        <Icon size={15} strokeWidth={2.25} aria-hidden="true" />
                        {label}
                      </span>
                      <span style={PREP_HINT}>{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tax — the note lives beside the control it explains */}
          <div style={rowStyle}>
            <div style={GROUP}>
              <label htmlFor="add-menu-gst" style={LABEL}>
                GST rate (%)
              </label>
              <select
                id="add-menu-gst"
                value={newItem.gst_rate}
                style={INPUT}
                onChange={(e) => onChange({ ...newItem, gst_rate: e.target.value })}
              >
                {GST_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div style={NOTE}>
              <Info size={14} strokeWidth={2} style={NOTE_ICON} aria-hidden="true" />
              <span>Price above is GST inclusive. Tax is extracted from it, not added on top.</span>
            </div>
          </div>

          {/* Photo — staged locally; see integration note before wiring S3 */}
          {enableImage && (
            <div style={GROUP}>
              <div style={LABEL_ROW}>
                <span id="add-menu-photo-label" style={LABEL}>
                  Photo
                </span>
                <span style={OPTIONAL_TAG}>Optional</span>
              </div>

              {file && previewUrl ? (
                <div style={PREVIEW_ROW}>
                  <img src={previewUrl} alt="" style={THUMB} />
                  <div style={PREVIEW_META}>
                    <span style={PREVIEW_NAME}>{file.name}</span>
                    <span style={PREVIEW_SIZE}>{formatFileSize(file.size)}</span>
                  </div>
                  <label
                    htmlFor="add-menu-image"
                    style={replaceStyle(hoverId === "replace")}
                    {...hoverProps("replace")}
                  >
                    Replace
                  </label>
                  <button
                    type="button"
                    style={removeBtnStyle(hoverId === "remove")}
                    {...hoverProps("remove")}
                    onClick={removeImage}
                    aria-label="Remove photo"
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="add-menu-image"
                  style={dropzoneStyle(dragOver, hoverId === "drop", dropFocused)}
                  {...hoverProps("drop")}
                  onDragOver={(e: DragEvent<HTMLLabelElement>) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e: DragEvent<HTMLLabelElement>) => {
                    e.preventDefault();
                    setDragOver(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) acceptFile(dropped);
                  }}
                >
                  <ImagePlus size={20} strokeWidth={1.75} style={DZ_ICON} aria-hidden="true" />
                  <span style={DZ_TITLE}>Upload a photo or drag &amp; drop</span>
                  <span style={DZ_HINT}>JPG or PNG</span>
                </label>
              )}

              <input
                id="add-menu-image"
                type="file"
                accept="image/*"
                style={SR_ONLY}
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) acceptFile(selected);
                  e.target.value = ""; // allows re-selecting the same file
                }}
                onFocus={() => setDropFocused(true)}
                onBlur={() => setDropFocused(false)}
              />

              {imageError && (
                <p role="alert" style={ERROR_TEXT}>
                  {imageError}
                </p>
              )}
            </div>
          )}
        </div>

        <div style={modalStyles.footer}>
          <button
            type="button"
            style={{
              ...modalStyles.secondaryButton,
              ...(submitting ? { opacity: 0.6, cursor: "default" } : null),
            }}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              ...modalStyles.primaryButton,
              ...(submitting ? { opacity: 0.6, cursor: "default" } : null),
            }}
            disabled={submitting}
          >
            {submitting ? "Adding…" : "Add Menu Item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
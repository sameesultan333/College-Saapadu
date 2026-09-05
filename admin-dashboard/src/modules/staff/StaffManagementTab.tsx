import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Bike, ChefHat, CircleAlert, Plus, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Canteen } from "../canteens/canteenService";
import { StaffMember, StaffRole, fetchStaff, toggleStaff, deleteStaff } from "./staffService";
import AddStaffModal from "./AddStaffModal";

interface StaffManagementTabProps {
  canteens: Canteen[];
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

/** Pulsing skeleton bar — one WAAPI loop per bar, guarded. */
function SkeletonBar({ width, delay }: { width: string; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const animation = ref.current.animate(
      [{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }],
      { duration: 1300, iterations: Infinity, delay, easing: "ease-in-out" }
    );
    return () => animation.cancel();
  }, [delay]);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      style={{
        display: "block",
        width,
        height: 12,
        borderRadius: "var(--bc-radius-pill)",
        backgroundColor: "var(--bc-color-neutral-bg-strong)",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Factories — standalone (a CSSProperties Record cannot hold fns)     */
/* ------------------------------------------------------------------ */

const ROLE_TABS: Array<{ id: StaffRole; label: string; icon: LucideIcon }> = [
  { id: "staff", label: "Staff", icon: ChefHat },
  { id: "delivery", label: "Delivery", icon: Bike },
];

const rowStyle = (hovered: boolean): CSSProperties => ({
  backgroundColor: hovered ? "var(--bc-color-surface-page-alt)" : "transparent",
  transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const toggleStyle = (active: boolean, hovered: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 36,
  padding: "0 var(--bc-space-12)",
  border: `1px solid ${active ? "var(--bc-color-success-border)" : hovered ? "var(--bc-color-border-strong)" : "var(--bc-color-border-default)"}`,
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: active ? "var(--bc-color-success-bg)" : hovered ? "var(--bc-color-surface-page-alt)" : "transparent",
  color: active ? "var(--bc-color-success-strong)" : "var(--bc-color-text-secondary)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const deleteStyle = (hovered: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  minHeight: 36,
  padding: "0 var(--bc-space-12)",
  border: `1px solid ${hovered ? "var(--bc-color-danger-border)" : "transparent"}`,
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: hovered ? "var(--bc-color-danger-bg)" : "transparent",
  color: "var(--bc-color-danger)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const avatarStyle = (role: StaffRole): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 34,
  height: 34,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: role === "delivery" ? "var(--bc-color-brand-action-soft)" : "var(--bc-color-brand-primary-soft)",
  color: role === "delivery" ? "var(--bc-color-brand-action)" : "var(--bc-color-brand-primary)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 700,
});

const segBtnStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 38,
  padding: "0 var(--bc-space-16)",
  border: 0,
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: active ? "var(--bc-color-brand-primary)" : "transparent",
  color: active ? "var(--bc-color-text-inverse)" : "var(--bc-color-text-secondary)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const statusPillStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: active ? "var(--bc-color-success-bg)" : "var(--bc-color-neutral-bg)",
  color: active ? "var(--bc-color-success-strong)" : "var(--bc-color-neutral-text)",
  fontSize: "var(--bc-font-size-caption)",
  fontWeight: 600,
  whiteSpace: "nowrap",
});
const STATUS_DOT: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "currentColor",
  opacity: 0.85,
};

const mobileCardStyle = (hovered: boolean): CSSProperties => ({
  display: "grid",
  gap: "var(--bc-space-12)",
  padding: "var(--bc-space-card-padding)",
  border: `1px solid ${hovered ? "var(--bc-color-border-strong)" : "var(--bc-color-border-subtle)"}`,
  borderRadius: "var(--bc-radius-lg)",
  backgroundColor: "var(--bc-color-surface-raised)",
  boxShadow: "var(--bc-shadow-card)",
  transition: "border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

/* ------------------------------------------------------------------ */
/* Static styles                                                       */
/* ------------------------------------------------------------------ */

const ROOT: CSSProperties = { display: "grid", gap: "var(--bc-space-24)", minWidth: 0 };

const HEAD: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "var(--bc-space-16)",
  flexWrap: "wrap",
};
const EYEBROW: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-brand-accent-strong)",
};
const TITLE: CSSProperties = {
  margin: "var(--bc-space-4) 0 0",
  fontSize: "var(--bc-font-size-page-heading)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  lineHeight: "var(--bc-line-height-tight)",
  color: "var(--bc-color-text-primary)",
};
const SUBTITLE: CSSProperties = {
  margin: "var(--bc-space-4) 0 0",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-muted)",
  maxWidth: "56ch",
};

const ADD_BUTTON: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--bc-space-8)",
  minHeight: 42,
  padding: "0 var(--bc-space-20)",
  border: "1px solid transparent",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-brand-primary)",
  color: "var(--bc-color-text-inverse)",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
};
const ADD_DISABLED: CSSProperties = { opacity: 0.5, cursor: "not-allowed" };

const TOOLBAR: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-12)",
  flexWrap: "wrap",
};
const SEG: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  padding: 3,
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-surface-sunken)",
};

const SELECT_WRAP: CSSProperties = { position: "relative", marginLeft: "auto", minWidth: 200 };
const SELECT: CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "0 var(--bc-space-32) 0 var(--bc-space-12)",
  border: "1px solid var(--bc-color-border-default)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-surface-raised)",
  color: "var(--bc-color-text-primary)",
  font: "inherit",
  fontSize: "var(--bc-font-size-secondary)",
  appearance: "none",
  WebkitAppearance: "none",
  cursor: "pointer",
};
const SELECT_CHEVRON: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: "0.75rem",
  transform: "translateY(-50%)",
  color: "var(--bc-color-text-muted)",
  pointerEvents: "none",
};

const CARD: CSSProperties = {
  background: "var(--bc-color-surface-raised)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-lg)",
  boxShadow: "var(--bc-shadow-card)",
  minWidth: 0,
};

const TABLE: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const TH: CSSProperties = {
  padding: "var(--bc-space-12) var(--bc-space-20)",
  textAlign: "left",
  borderBottom: "1px solid var(--bc-color-border-subtle)",
  backgroundColor: "var(--bc-color-surface-page-alt)",
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted)",
  whiteSpace: "nowrap",
};
const TD: CSSProperties = {
  padding: "var(--bc-space-12) var(--bc-space-20)",
  borderBottom: "1px solid var(--bc-color-border-subtle)",
  verticalAlign: "middle",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-primary)",
};
const TD_LAST: CSSProperties = { ...TD, borderBottom: 0 };
const NAME_CELL: CSSProperties = { display: "flex", alignItems: "center", gap: "var(--bc-space-12)", minWidth: 0 };
const NAME_TEXT: CSSProperties = {
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const PHONE_TEXT: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-secondary)",
};
const ACTIONS: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "var(--bc-space-8)" };

/* Error card */
const ERROR_CARD: CSSProperties = {
  ...CARD,
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-12)",
  padding: "var(--bc-space-20)",
  borderColor: "var(--bc-color-danger-border)",
  backgroundColor: "var(--bc-color-danger-bg)",
};
const ERROR_ICON: CSSProperties = { flex: "none", marginTop: 1, color: "var(--bc-color-danger)" };
const ERROR_TEXT: CSSProperties = {
  margin: 0,
  flex: 1,
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  color: "var(--bc-color-danger-strong)",
};
const RETRY_BUTTON: CSSProperties = {
  flex: "none",
  minHeight: 36,
  padding: "0 var(--bc-space-16)",
  border: "1px solid var(--bc-color-danger-border)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "transparent",
  color: "var(--bc-color-danger-strong)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  cursor: "pointer",
};

/* Empty state */
const EMPTY: CSSProperties = {
  ...CARD,
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-56) var(--bc-space-24)",
  textAlign: "center",
};
const EMPTY_ICON: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 52,
  height: 52,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
};
const EMPTY_TITLE: CSSProperties = {
  margin: "var(--bc-space-4) 0 0",
  fontSize: "var(--bc-font-size-section-heading)",
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
};
const EMPTY_BODY: CSSProperties = {
  margin: 0,
  maxWidth: "44ch",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-muted)",
};

/* Skeleton card */
const SKELETON: CSSProperties = {
  ...CARD,
  display: "grid",
  gap: "var(--bc-space-16)",
  padding: "var(--bc-space-card-padding)",
};
const SKELETON_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bc-space-16)",
};
const AVATAR_SKELETON: CSSProperties = {
  flex: "none",
  width: 34,
  height: 34,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "var(--bc-color-neutral-bg-strong)",
};

/* Mobile cards */
const CARD_LIST: CSSProperties = { display: "grid", gap: "var(--bc-space-12)" };
const CARD_HEAD: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--bc-space-8)",
};
const CARD_META: CSSProperties = { display: "grid", gap: 3, minWidth: 0 };
const CARD_META_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted)",
};
const CARD_ACTIONS: CSSProperties = {
  display: "flex",
  gap: "var(--bc-space-8)",
  paddingTop: "var(--bc-space-12)",
  borderTop: "1px dashed var(--bc-color-border-default)",
};
const CARD_ACTION_BUTTON: CSSProperties = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  border: "1px solid var(--bc-color-border-default)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "transparent",
  color: "var(--bc-color-text-secondary)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  cursor: "pointer",
};

const ROOT_REF_ANIM_MS = 260;

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

// Manager-only. Lists staff/delivery accounts across the manager's own
// college (optionally filtered to one canteen), lets them add an account
// scoped to one of their own canteens, and toggle an account active/inactive.
export default function StaffManagementTab({ canteens }: StaffManagementTabProps) {
  const isCompact = useMediaQuery("(max-width: 860px)");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roleTab, setRoleTab] = useState<StaffRole>("staff");
  const [canteenFilter, setCanteenFilter] = useState("ALL");
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoverId, setHoverId] = useState<number | "toggle" | "delete" | "retry" | "add" | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !rootRef.current) return;
    const animation = rootRef.current.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: ROOT_REF_ANIM_MS, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  const canteenName = (id: number) => canteens.find((c) => c.id === id)?.name || `Canteen #${id}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchStaff(roleTab, canteenFilter === "ALL" ? undefined : Number(canteenFilter));
      setStaff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [roleTab, canteenFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (staffId: number) => {
    setStaff((prev) => prev.map((s) => (s.id === staffId ? { ...s, is_active: !s.is_active } : s)));
    try {
      await toggleStaff(staffId);
    } catch {
      load();
    }
  };

  const handleDelete = async (member: StaffMember) => {
    const confirmed = window.confirm(
      `Permanently delete ${member.role === "delivery" ? "delivery account" : "staff account"} "${member.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteStaff(member.id);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
    }
  };

  const isDelivery = roleTab === "delivery";
  const RoleIcon = isDelivery ? Bike : ChefHat;

  const hoverProps = (id: NonNullable<typeof hoverId>) => ({
    onMouseEnter: () => setHoverId(id),
    onMouseLeave: () => setHoverId((current) => (current === id ? null : current)),
  });

  const renderActions = (member: StaffMember, stacked: boolean) => (
    <div style={stacked ? CARD_ACTIONS : ACTIONS}>
      <button
        type="button"
        style={
          stacked
            ? toggleStyle(member.is_active, false)
            : toggleStyle(member.is_active, hoverId === `toggle-${member.id}` as unknown as number)
        }
        onClick={() => handleToggle(member.id)}
      >
        {member.is_active ? "Deactivate" : "Activate"}
      </button>
      <button
        type="button"
        style={
          stacked
            ? { ...CARD_ACTION_BUTTON, color: "var(--bc-color-danger)", borderColor: "var(--bc-color-danger-border)" }
            : deleteStyle(hoverId === member.id)
        }
        onClick={() => handleDelete(member)}
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
        Delete
      </button>
    </div>
  );

  return (
    <div ref={rootRef} style={ROOT}>
      {/* Header */}
      <header style={HEAD}>
        <div>
          <p style={EYEBROW}>Team</p>
          <h2 style={TITLE}>Staff Management</h2>
          <p style={SUBTITLE}>
            Create and manage staff and delivery accounts for your canteens
          </p>
        </div>
        <button
          type="button"
          title={canteens.length === 0 ? "Add a canteen first" : undefined}
          style={{
            ...ADD_BUTTON,
            ...(canteens.length === 0 ? ADD_DISABLED : null),
            ...(hoverId === "add" && canteens.length > 0 ? { backgroundColor: "var(--bc-color-brand-primary-hover)" } : null),
          }}
          disabled={canteens.length === 0}
          {...hoverProps("add")}
          onClick={() => setShowAddStaff(true)}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          {isDelivery ? "Add Delivery" : "Add Staff"}
        </button>
      </header>

      {/* Toolbar: role segments + canteen filter */}
      <div style={TOOLBAR}>
        <div style={SEG} role="group" aria-label="Account type">
          {ROLE_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              style={segBtnStyle(roleTab === id)}
              aria-pressed={roleTab === id}
              onClick={() => setRoleTab(id)}
            >
              <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div style={SELECT_WRAP}>
          <select
            aria-label="Filter by canteen"
            style={SELECT}
            value={canteenFilter}
            onChange={(e) => setCanteenFilter(e.target.value)}
          >
            <option value="ALL">All Canteens</option>
            {canteens.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 24 24" width={15} height={15} style={SELECT_CHEVRON} aria-hidden="true" focusable="false">
            <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* States */}
      {loading ? (
        <div style={SKELETON} role="status" aria-live="polite">
          <span style={{ fontSize: "var(--bc-font-size-secondary)", color: "var(--bc-color-text-muted)" }}>
            Loading {isDelivery ? "delivery" : "staff"} accounts…
          </span>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} style={SKELETON_ROW}>
              <span style={AVATAR_SKELETON} aria-hidden="true" />
              <SkeletonBar width="30%" delay={row * 120} />
              <SkeletonBar width="22%" delay={row * 120 + 80} />
              <SkeletonBar width="16%" delay={row * 120 + 160} />
            </div>
          ))}
        </div>
      ) : staff.length === 0 ? (
        error ? (
          <div style={ERROR_CARD} role="alert">
            <CircleAlert size={18} strokeWidth={2} style={ERROR_ICON} aria-hidden="true" />
            <p style={ERROR_TEXT}>{error}</p>
            <button
              type="button"
              style={{
                ...RETRY_BUTTON,
                ...(hoverId === "retry" ? { backgroundColor: "var(--bc-color-danger-bg)" } : null),
              }}
              {...hoverProps("retry")}
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        ) : (
          <div style={EMPTY}>
            <span style={EMPTY_ICON} aria-hidden="true">
              <RoleIcon size={22} strokeWidth={1.75} />
            </span>
            <h3 style={EMPTY_TITLE}>No {isDelivery ? "delivery" : "staff"} accounts yet</h3>
            <p style={EMPTY_BODY}>
              {isDelivery
                ? "Add a delivery account to let them confirm pickups for a canteen"
                : "Add a staff account to let them run a canteen's day-to-day operations"}
            </p>
          </div>
        )
      ) : (
        <>
          {error && (
            <div style={ERROR_CARD} role="alert">
              <CircleAlert size={18} strokeWidth={2} style={ERROR_ICON} aria-hidden="true" />
              <p style={ERROR_TEXT}>{error}</p>
              <button
                type="button"
                style={{ ...RETRY_BUTTON, ...(hoverId === "retry" ? { backgroundColor: "var(--bc-color-danger-bg)" } : null) }}
                {...hoverProps("retry")}
                onClick={() => void load()}
              >
                Retry
              </button>
            </div>
          )}

          {isCompact ? (
            <div style={CARD_LIST}>
              {staff.map((s) => (
                <article
                  key={s.id}
                  style={mobileCardStyle(hoverId === s.id)}
                  onMouseEnter={() => setHoverId(s.id)}
                  onMouseLeave={() => setHoverId((current) => (current === s.id ? null : current))}
                >
                  <div style={CARD_HEAD}>
                    <div style={NAME_CELL}>
                      <span style={avatarStyle(s.role)} aria-hidden="true">
                        {s.name?.trim().charAt(0).toUpperCase() || (s.role === "delivery" ? "D" : "S")}
                      </span>
                      <span style={NAME_TEXT}>{s.name}</span>
                    </div>
                    <span style={statusPillStyle(s.is_active)}>
                      <span style={STATUS_DOT} aria-hidden="true" />
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div style={CARD_META}>
                    <span style={CARD_META_LABEL}>Phone</span>
                    <span style={PHONE_TEXT}>{s.phone}</span>
                  </div>
                  <div style={CARD_META}>
                    <span style={CARD_META_LABEL}>Canteen</span>
                    <span>{canteenName(s.canteen_id)}</span>
                  </div>

                  {renderActions(s, true)}
                </article>
              ))}
            </div>
          ) : (
            <div style={{ ...CARD, overflowX: "auto" }}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Name</th>
                    <th style={TH}>Phone</th>
                    <th style={TH}>Canteen</th>
                    <th style={TH}>Status</th>
                    <th style={TH}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr
                      key={s.id}
                      style={rowStyle(hoverId === s.id)}
                      onMouseEnter={() => setHoverId(s.id)}
                      onMouseLeave={() => setHoverId((current) => (current === s.id ? null : current))}
                    >
                      <td style={s === staff[staff.length - 1] ? { ...TD, ...TD_LAST } : TD}>
                        <div style={NAME_CELL}>
                          <span style={avatarStyle(s.role)} aria-hidden="true">
                            {s.name?.trim().charAt(0).toUpperCase() || (s.role === "delivery" ? "D" : "S")}
                          </span>
                          <span style={NAME_TEXT}>{s.name}</span>
                        </div>
                      </td>
                      <td style={s === staff[staff.length - 1] ? { ...TD, ...TD_LAST } : TD}>
                        <span style={PHONE_TEXT}>{s.phone}</span>
                      </td>
                      <td style={s === staff[staff.length - 1] ? { ...TD, ...TD_LAST } : TD}>
                        {canteenName(s.canteen_id)}
                      </td>
                      <td style={s === staff[staff.length - 1] ? { ...TD, ...TD_LAST } : TD}>
                        <span style={statusPillStyle(s.is_active)}>
                          <span style={STATUS_DOT} aria-hidden="true" />
                          {s.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ ...(s === staff[staff.length - 1] ? { ...TD, ...TD_LAST } : TD), textAlign: "right" }}>
                        {renderActions(s, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showAddStaff && (
        <AddStaffModal
          canteens={canteens}
          defaultRole={roleTab}
          onClose={() => setShowAddStaff(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
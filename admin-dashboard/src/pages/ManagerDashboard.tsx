import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Building2, ChefHat, ReceiptText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AdminLayout from "../layouts/AdminLayout/AdminLayout";
import AdminDashboard from "./AdminDashboard";
import CanteenGrid from "../modules/canteens/CanteenGrid";
import AddCanteenModal from "../modules/canteens/AddCanteenModal";
import EditCanteenModal from "../modules/canteens/EditCanteenModal";
import StaffManagementTab from "../modules/staff/StaffManagementTab";
import ReportsTab from "../modules/reports/ReportsTab";
import { Canteen, fetchCanteensAdmin } from "../modules/canteens/canteenService";
import { API } from "../config/api";
import { getSession } from "../auth/session";

interface ManagerDashboardProps {
  onLogout: () => void;
}

type ManagerTab = "canteens" | "staff" | "reports";

/** Same shape AdminLayout already receives from AdminDashboard, with this
 *  dashboard's own tab ids. AdminLayout's tabs prop should type `id: string`
 *  (a superset of both) and render `icon` as a component. */
interface ManagerTabDefinition {
  id: ManagerTab;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

/* Computed once at module load — the theme's global reduced-motion rule
   only reaches CSS animations, so WAAPI effects need their own guard. */
const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Motion primitives — the WAAPI replacements for @keyframes           */
/* ------------------------------------------------------------------ */

/** Indeterminate load bar (boot state). */
function BootBar() {
  const fillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION || !fillRef.current) return;
    const animation = fillRef.current.animate(
      [{ transform: "translateX(-110%)" }, { transform: "translateX(360%)" }],
      { duration: 1100, iterations: Infinity, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  return (
    <span style={BOOT.bar} aria-hidden="true">
      <span ref={fillRef} style={BOOT.barFill} />
    </span>
  );
}

/** Tab content wrapper — a short settle-in each time the active tab remounts. */
function TabPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const animation = ref.current.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  return <div ref={ref}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Boot screen styles — token-only                                     */
/* ------------------------------------------------------------------ */

const BOOT = {
  root: {
    display: "grid",
    justifyItems: "center",
    gap: "var(--bc-space-8)",
    padding: "var(--bc-space-56) var(--bc-space-16)",
    minHeight: "40vh",
    textAlign: "center",
  } as CSSProperties,
  eyebrow: {
    margin: 0,
    fontSize: "var(--bc-font-size-eyebrow)",
    fontWeight: 600,
    letterSpacing: "var(--bc-letter-spacing-eyebrow)",
    textTransform: "uppercase",
    color: "var(--bc-color-brand-accent-strong)",
  } as CSSProperties,
  title: {
    margin: "var(--bc-space-4) 0 0",
    fontSize: "var(--bc-font-size-page-heading)",
    fontWeight: 700,
    letterSpacing: "var(--bc-letter-spacing-tight)",
    color: "var(--bc-color-text-primary)",
  } as CSSProperties,
  sub: {
    margin: "var(--bc-space-4) 0 0",
    fontSize: "var(--bc-font-size-body)",
    color: "var(--bc-color-text-muted)",
  } as CSSProperties,
  bar: {
    position: "relative",
    display: "block",
    overflow: "hidden",
    width: 180,
    height: 3,
    marginTop: "var(--bc-space-16)",
    borderRadius: "var(--bc-radius-pill)",
    backgroundColor: "var(--bc-color-neutral-bg-strong)",
  } as CSSProperties,
  barFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "40%",
    borderRadius: "inherit",
    backgroundColor: "var(--bc-color-brand-primary)",
  } as CSSProperties,
};

// College-wide view for a Manager account. Lists the college's canteens,
// lets the manager add a canteen and manage staff accounts, and — when a
// canteen is opened — hands off to the existing per-canteen operational
// dashboard (AdminDashboard, unchanged business logic) full-screen.
export default function ManagerDashboard({ onLogout }: ManagerDashboardProps) {
  const session = getSession();
  const collegeId = session?.college_id;

  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [collegeName, setCollegeName] = useState("Manager Dashboard");
  const [activeTab, setActiveTab] = useState<ManagerTab>("canteens");
  const [openCanteen, setOpenCanteen] = useState<Canteen | null>(null);
  const [showAddCanteen, setShowAddCanteen] = useState(false);
  const [editingCanteen, setEditingCanteen] = useState<Canteen | null>(null);
  // Covers only the first load; reloads triggered by AddCanteenModal never flash it.
  const [initializing, setInitializing] = useState(true);

  const loadCanteens = useCallback(async (): Promise<void> => {
    if (collegeId == null) return;
    try {
      // /canteens/admin (auth-scoped to the manager's own college) so
      // closed canteens still show up here to be reopened -- the public
      // /canteens listing (used by the mobile app) only ever returns open
      // ones.
      const data = await fetchCanteensAdmin();
      setCanteens(data);
    } catch {
      // leave canteens as-is; the grid shows an empty state either way
    }
  }, [collegeId]);

  useEffect(() => {
    void loadCanteens().finally(() => setInitializing(false));
  }, [loadCanteens]);

  useEffect(() => {
    if (collegeId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/colleges`);
        if (!res.ok) return;
        const colleges = (await res.json()) as Array<{ id: number; name: string }>;
        const mine = colleges.find((c) => c.id === collegeId);
        if (mine && !cancelled) setCollegeName(mine.name);
      } catch {
        // keep the fallback title
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collegeId]);

  if (!session) {
    return (
      <div className="canteen-dashboard">
        <div className="session-expired">
          <p>Session expired. Please login again.</p>
        </div>
      </div>
    );
  }

  if (openCanteen) {
    return (
      <AdminDashboard
        canteenId={openCanteen.id}
        canteenName={openCanteen.name}
        onBack={() => setOpenCanteen(null)}
        onLogout={onLogout}
      />
    );
  }

  const tabs: ManagerTabDefinition[] = [
    // Real count from the fetched canteens; suppressed at zero so an empty
    // college doesn't wear an "alert" pill.
    { id: "canteens", icon: Building2, label: "Canteens", badge: canteens.length > 0 ? canteens.length : undefined },
    { id: "staff", icon: ChefHat, label: "Staff Management" },
    { id: "reports", icon: ReceiptText, label: "Sales & GST" },
  ];

  const handleSelectTab = (id: string): void => {
    setActiveTab(id as ManagerTab);
  };

  if (initializing) {
    return (
      <AdminLayout
        canteenName={collegeName}
        onLogout={onLogout}
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
      >
        <div style={BOOT.root} role="status" aria-live="polite">
          <p style={BOOT.eyebrow}>College Saapadu</p>
          <h2 style={BOOT.title}>Preparing your workspace</h2>
          <p style={BOOT.sub}>Loading canteens, staff accounts and reports…</p>
          <BootBar />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      canteenName={collegeName}
      onLogout={onLogout}
      tabs={tabs}
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
    >
      {/* key remounts per tab — same unmount/remount the conditional renders
          always did; the wrapper only adds the settle-in animation */}
      <TabPanel key={activeTab}>
        {activeTab === "canteens" && (
          <CanteenGrid
            canteens={canteens}
            onOpen={setOpenCanteen}
            onAddClick={() => setShowAddCanteen(true)}
            onEditClick={setEditingCanteen}
          />
        )}

        {activeTab === "staff" && <StaffManagementTab canteens={canteens} />}

        {activeTab === "reports" && <ReportsTab canteens={canteens} />}
      </TabPanel>

      {showAddCanteen && (
        <AddCanteenModal onClose={() => setShowAddCanteen(false)} onCreated={loadCanteens} />
      )}

      {editingCanteen && (
        <EditCanteenModal
          canteen={editingCanteen}
          onClose={() => setEditingCanteen(null)}
          onUpdated={(updated) =>
            setCanteens((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
          }
        />
      )}
    </AdminLayout>
  );
}
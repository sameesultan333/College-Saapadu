import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Truck } from "lucide-react";

import DeliveryLayout from "../layouts/DeliveryLayout/DeliveryLayout";
import OrderTabs from "../modules/orders/OrderTabs";
import OrdersSection from "../modules/orders/OrdersSection";
import type { DeliveryOrderItem } from "../modules/orders/OrdersSection";
import OrderReceiptModal from "../modules/orders/OrderReceiptModal";
import useOrders from "../modules/orders/useOrders";
import QRScanner from "../modules/delivery/QRScanner";
import VerificationSheet from "../modules/delivery/VerificationSheet";
import LoadingOverlay from "../components/LoadingOverlay";
import NotificationToast from "../components/NotificationToast";
import { getSession } from "../auth/session";

interface DeliveryDashboardProps {
  onLogout: () => void;
}

/* ------------------------------------------------------------------ */
/* Types — derived from the real hook, so they stay correct as
   useOrders evolves. No duplicated order interface to drift.           */
/* ------------------------------------------------------------------ */

type UseOrdersReturn = ReturnType<typeof useOrders>;
type DeliveryOrder = UseOrdersReturn["preparingOrders"][number];

type DeliveryTab = "preparing" | "ready";

/* ------------------------------------------------------------------ */
/* Motion helpers — the established inline-style kit                   */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const animation = ref.current.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);
  return <div ref={ref} style={{ minWidth: 0 }}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Boot screen — the docket language: amber spine, ticket card.        */
/* Shown only until the first fetch settles; LoadingOverlay keeps      */
/* handling every in-session operation after that.                     */
/* ------------------------------------------------------------------ */

const BOOT: Record<string, CSSProperties> = {
  card: {
    position: "relative",
    display: "grid",
    justifyItems: "center",
    gap: "var(--bc-space-8)",
    maxWidth: 420,
    margin: "var(--bc-space-40) auto 0",
    padding: "var(--bc-space-32) var(--bc-space-24)",
    background: "var(--bc-color-surface-raised)",
    border: "1px solid var(--bc-color-border-subtle)",
    borderTop: "4px solid var(--bc-dlv-color-accent, #d98e3b)",
    borderRadius: "var(--bc-radius-lg)",
    boxShadow: "var(--bc-shadow-card)",
    textAlign: "center",
  },
  mark: {
    display: "grid",
    placeItems: "center",
    width: 44,
    height: 44,
    borderRadius: "var(--bc-radius-md)",
    backgroundColor: "var(--bc-color-brand-action-soft, #fdf3e8)",
    color: "var(--bc-color-brand-action, #d96f2b)",
  },
  eyebrow: {
    margin: "var(--bc-space-4) 0 0",
    fontSize: "var(--bc-font-size-eyebrow, 0.6875rem)",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--bc-color-text-muted)",
  },
  title: {
    margin: 0,
    fontSize: "var(--bc-font-size-page-heading, 1.5rem)",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--bc-color-text-primary)",
  },
  sub: {
    margin: 0,
    fontSize: "var(--bc-font-size-secondary, 0.8125rem)",
    color: "var(--bc-color-text-muted)",
  },
  bar: {
    position: "relative",
    overflow: "hidden",
    width: 180,
    height: 3,
    marginTop: "var(--bc-space-12)",
    borderRadius: 999,
    backgroundColor: "var(--bc-color-neutral-bg-strong)",
  },
  barFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "40%",
    borderRadius: "inherit",
    backgroundColor: "var(--bc-dlv-color-accent, #d98e3b)",
  },
};

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

function BootScreen() {
  return (
    <div style={BOOT.card} role="status" aria-live="polite">
      <span style={BOOT.mark} aria-hidden="true">
        <Truck size={22} strokeWidth={1.9} />
      </span>
      <p style={BOOT.eyebrow}>College Saapaadu · Delivery</p>
      <h2 style={BOOT.title}>Preparing your route</h2>
      <p style={BOOT.sub}>Syncing today&apos;s orders from the kitchen…</p>
      <BootBar />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function DeliveryDashboard({ onLogout }: DeliveryDashboardProps) {
  /* ================= AUTH ================= */
  const delivery = getSession();
  const CANTEEN_ID = delivery?.canteen_id ?? undefined;
  const CANTEEN_NAME = delivery?.canteen_name || "Delivery Counter";
  const COURIER_NAME = delivery?.name;

  /* ================= UI / FLOW STATE ================= */
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState<DeliveryOrder | null>(null);
  const [activeTab, setActiveTab] = useState<DeliveryTab>("preparing"); // 'preparing' or 'ready'
  // Covers only the first load; in-session operations keep using LoadingOverlay.
  const [booted, setBooted] = useState(false);

  const {
    preparingOrders,
    readyOrders,
    loading,
    newOrderInfo,
    dismissNewOrderInfo,
    updateStatus,
    markReady,
  } = useOrders(CANTEEN_ID, CANTEEN_NAME);

  /* ================= GUARD ================= */
  useEffect(() => {
    if (!delivery) onLogout();
  }, [delivery, onLogout]);

  /* First fetch settled → dismiss the boot screen (also covers the
     failed-fetch case, so the sections' own empty states take over). */
  useEffect(() => {
    if (!loading && !booted) setBooted(true);
  }, [loading, booted]);

  /* ================= ACTIONS ================= */
  const handleMarkReady = async (order: DeliveryOrder): Promise<void> => {
    const ok = await markReady(order);
    if (ok) {
      setSelectedOrder(null);
      setActiveTab("ready");
    }
  };

  const totalAmountOf = (order: DeliveryOrder): string =>
    order.items
      .reduce((s: number, i: DeliveryOrderItem) => s + (i.price || 0) * i.quantity, 0)
      .toFixed(2);

  const handleDeliver = async (order: DeliveryOrder): Promise<void> => {
    if (order.payment_mode === "CASH") {
      const confirmed = window.confirm(
        `⚠️ CASH ORDER\n\nCollect ₹${totalAmountOf(order)} from ${order.student_name} before delivering.\n\nHave you collected the cash?`
      );
      if (!confirmed) return;
    }

    const ok = await updateStatus(order.order_id, "DELIVERED");
    if (ok) {
      setVerifiedOrder(null);
      setSelectedOrder(null);
      setScannerOpen(false);
    }
  };

  // The guard effect fires onLogout; returning null avoids a one-frame
  // flash of the empty dashboard before it lands.
  if (!delivery) return null;

  return (
    <DeliveryLayout canteenName={CANTEEN_NAME} courierName={COURIER_NAME} onLogout={onLogout}>
      {!booted ? (
        <BootScreen />
      ) : (
        <>
          <OrderTabs
            activeTab={activeTab}
            onChange={(tab: string) => setActiveTab(tab as DeliveryTab)}
            preparingCount={preparingOrders.length}
            readyCount={readyOrders.length}
          />

          <Reveal key={activeTab}>
            {activeTab === "preparing" ? (
              <OrdersSection
                variant="preparing"
                orders={preparingOrders}
                onSelectOrder={setSelectedOrder}
                onPrimaryAction={handleMarkReady}
              />
            ) : (
              <OrdersSection
                variant="ready"
                orders={readyOrders}
                onSelectOrder={setSelectedOrder}
                onPrimaryAction={(order: DeliveryOrder) => {
                  setSelectedOrder(order);
                  setScannerOpen(true);
                }}
              />
            )}
          </Reveal>
        </>
      )}

      {selectedOrder && !scannerOpen && !verifiedOrder && (
        <OrderReceiptModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onMarkReady={() => handleMarkReady(selectedOrder)}
          onStartScan={() => setScannerOpen(true)}
        />
      )}

      {scannerOpen && (
        <QRScanner
          selectedOrder={selectedOrder}
          onVerified={(order: DeliveryOrder) => {
            setScannerOpen(false);
            setVerifiedOrder(order);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <VerificationSheet
        order={verifiedOrder}
        onComplete={handleDeliver}
        onCancel={() => setVerifiedOrder(null)}
      />

      {loading && booted && <LoadingOverlay />}

      <NotificationToast info={newOrderInfo} onClose={dismissNewOrderInfo} />
    </DeliveryLayout>
  );
}
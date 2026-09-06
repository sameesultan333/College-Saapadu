import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { BellRing, History, LayoutDashboard, Package, UserRound } from "lucide-react";

import { WS } from "../config/api";
import { apiFetch } from "../services/apiClient";
import { getSession } from "../auth/session";

import AdminLayout from "../layouts/AdminLayout/AdminLayout";
import SuccessToast from "../components/Toast/SuccessToast";
import NewOrderAlert from "../components/Toast/NewOrderAlert";

import OverviewTab from "../modules/dashboard/OverviewTab";
import ActiveOrdersTab from "../modules/orders/ActiveOrdersTab";
import HistoryTab from "../modules/orders/HistoryTab";
import OrderDetailsModal from "../modules/orders/OrderDetailsModal";
import {
  fetchOrders,
  fetchStats,
  fetchHistory,
  updateOrderStatus,
  confirmOrderPayment,
} from "../modules/orders/orderService";

import StockTab from "../modules/menu/StockTab";
import { fetchMenu, addMenuItem, updateStock as updateStockRequest } from "../modules/menu/menuService";
import AddMenuModal from "../modules/menu/AddMenuModal";
import EditCanteenModal from "../modules/canteens/EditCanteenModal";
import { Canteen, fetchCanteensAdmin } from "../modules/canteens/canteenService";

import { parseSocketEvent } from "../types";
import type {
  CanteenStats,
  HistoryEntry,
  MenuItem,
  NewMenuItemForm,
  Order,
  OrderStatus,
} from "../types";

interface StaffDashboardProps {
  onLogout: () => void;
}

interface Profile {
  name: string;
  staff_id: string | null;
  phone: string;
  canteen_name: string | null;
}

type StaffTab = "overview" | "active-orders" | "stock" | "history" | "profile";
type OrderTypeFilter = "ALL" | "COUNTER" | "ONLINE";

const NEW_ORDER_ALERT_MS = 5000;
const STOCK_DEBOUNCE_MS = 400;
const WS_RECONNECT_DELAY_MS = 3000;

/* ------------------------------------------------------------------ */
/* Module-scope formatters — stable identities for memoized children   */
/* ------------------------------------------------------------------ */

const formatCurrency = (amount: number): string =>
  `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getTimeAgo = (timestamp?: string | null): string => {
  if (!timestamp) return "Just now";
  const diffMins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago`;
};

const formatDate = (timestamp?: string | null): string => {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ------------------------------------------------------------------ */
/* Stylesheet — boot, offline banner, and the crew badge. Namespaced   */
/* "sd-", --bc-* tokens only.                                          */
/* ------------------------------------------------------------------ */

const STAFF_CSS = `
.sd-boot{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:46vh;padding:var(--bc-space-32) var(--bc-space-16);text-align:center}
.sd-boot-eyebrow{font-size:var(--bc-font-size-eyebrow);font-weight:var(--bc-font-weight-eyebrow);letter-spacing:var(--bc-letter-spacing-eyebrow);text-transform:uppercase;color:var(--bc-color-brand-accent-strong)}
.sd-boot-title{margin-top:var(--bc-space-8);font-size:var(--bc-font-size-page-heading);font-weight:var(--bc-font-weight-page-heading);letter-spacing:var(--bc-letter-spacing-tight);color:var(--bc-color-text-primary)}
.sd-boot-sub{margin-top:var(--bc-space-4);font-size:var(--bc-font-size-secondary);color:var(--bc-color-text-muted)}
.sd-boot-bar{position:relative;overflow:hidden;width:180px;height:3px;margin-top:var(--bc-space-24);border-radius:var(--bc-radius-pill);background:var(--bc-color-neutral-bg-strong)}
.sd-boot-bar::after{content:"";position:absolute;top:0;bottom:0;left:0;width:40%;border-radius:inherit;background:var(--bc-color-brand-primary);animation:sd-sweep 1.1s var(--bc-motion-easing-standard) infinite}
@keyframes sd-sweep{from{transform:translateX(-110%)}to{transform:translateX(360%)}}

.sd-offline{display:flex;align-items:center;justify-content:center;gap:var(--bc-space-8);margin-bottom:var(--bc-space-16);padding:9px var(--bc-space-16);border:1px solid var(--bc-color-warning-border);border-radius:var(--bc-radius-md);background:var(--bc-color-warning-bg);color:var(--bc-color-warning-strong);font-size:var(--bc-font-size-secondary);font-weight:600}
.sd-offline-dot{flex:none;width:8px;height:8px;border-radius:var(--bc-radius-round);background:var(--bc-color-warning-light);animation:sd-blink 1.4s ease-in-out infinite}
@keyframes sd-blink{0%,100%{opacity:1}50%{opacity:.35}}

/* ---- Crew badge — the staff profile as an artifact ---- */
.sd-badge{position:relative;max-width:460px;margin:0 auto;padding:var(--bc-space-24);background:var(--bc-color-brand-primary);border-radius:var(--bc-radius-lg);box-shadow:var(--bc-shadow-elevated);overflow:hidden;color:var(--bc-color-text-inverse)}
.sd-badge-sprig{position:absolute;right:-26px;bottom:-30px;opacity:.12;color:var(--bc-color-brand-accent);pointer-events:none}
.sd-badge-head{display:flex;align-items:center;gap:var(--bc-space-12)}
.sd-badge-mark{display:grid;place-items:center;flex:none;width:44px;height:44px;border:1px solid var(--bc-color-white-alpha-10);border-radius:var(--bc-radius-lg);background:var(--bc-color-white-alpha-10);color:var(--bc-color-brand-accent)}
.sd-badge-eyebrow{font-size:var(--bc-font-size-eyebrow);font-weight:var(--bc-font-weight-eyebrow);letter-spacing:var(--bc-letter-spacing-eyebrow);text-transform:uppercase;color:var(--bc-color-brand-accent-soft)}
.sd-badge-name{margin-top:2px;font-size:var(--bc-font-size-page-heading);font-weight:var(--bc-font-weight-page-heading);letter-spacing:var(--bc-letter-spacing-tight);line-height:var(--bc-line-height-tight);color:var(--bc-color-text-inverse);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sd-badge-tear{position:relative;border-top:2px dashed var(--bc-color-white-alpha-20);margin:var(--bc-space-20) calc(-1 * var(--bc-space-24)) 0}
.sd-badge-tear span{position:absolute;top:-8px;width:16px;height:16px;border-radius:var(--bc-radius-round);background:var(--bc-color-surface-page)}
.sd-badge-tear span:first-child{left:-11px}
.sd-badge-tear span:last-child{right:-11px}
.sd-badge-rows{display:grid;gap:var(--bc-space-8);padding-top:var(--bc-space-20)}
.sd-badge-row{display:flex;align-items:baseline;justify-content:space-between;gap:var(--bc-space-12)}
.sd-badge-label{font-size:var(--bc-font-size-eyebrow);font-weight:600;letter-spacing:var(--bc-letter-spacing-eyebrow);text-transform:uppercase;color:var(--bc-color-white-alpha-80)}
.sd-badge-value{font-family:var(--bc-login-font-family-mono);font-size:var(--bc-font-size-secondary);font-variant-numeric:tabular-nums;color:var(--bc-color-text-inverse);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sd-badge-foot{display:flex;align-items:center;justify-content:space-between;gap:var(--bc-space-12);padding-top:var(--bc-space-20);flex-wrap:wrap}
.sd-badge-scope{margin:0;font-size:var(--bc-font-size-caption);color:var(--bc-color-white-alpha-80)}
.sd-badge-edit{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 var(--bc-space-16);border:1px solid var(--bc-color-white-alpha-25);border-radius:var(--bc-radius-md);background:var(--bc-color-white-alpha-10);color:var(--bc-color-text-inverse);font-size:var(--bc-font-size-secondary);font-weight:600;cursor:pointer;font-family:var(--bc-font-family);transition:background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)}
.sd-badge-edit:hover:not(:disabled){background:var(--bc-color-white-alpha-20)}
.sd-badge-edit:disabled{opacity:.6;cursor:default}
.sd-badge :focus-visible{outline:2px solid var(--bc-color-white-alpha-80);outline-offset:2px;border-radius:var(--bc-radius-sm)}
`;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

// Deliberately simple, large-button single-canteen shell for a Staff
// account. Reuses the same Overview/ActiveOrders/Stock/History module
// components AdminDashboard uses (same order/menu/websocket business
// logic — nothing about how orders/stock work was changed here), but the
// navigation chrome is intentionally smaller: no Counter, no Insights, no
// Add Canteen, no Staff Management, no canteen switcher. The staff member's
// canteen comes only from their own session/profile — never user-selectable.
export default function StaffDashboard({ onLogout }: StaffDashboardProps) {
  const session = getSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<CanteenStats | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<StaffTab>("overview");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "ALL">("ALL");
  const [filterType, setFilterType] = useState<OrderTypeFilter>("ALL");
  const [newOrderNotification, setNewOrderNotification] = useState<{ id: number; time: string } | null>(null);
  // Vestigial in the source (never set true) — kept so the SuccessToast
  // wiring survives unchanged if the counter flow is ever ported here.
  const [showOrderSuccess] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(null);
  const [editingCanteen, setEditingCanteen] = useState<Canteen | null>(null);
  const [loadingCanteenEdit, setLoadingCanteenEdit] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [newItem, setNewItem] = useState<NewMenuItemForm>({
    name: "",
    price: "",
    stock: "",
    is_veg: true,
    prep_type: "RA",
    gst_rate: "5",
  });

  const stockTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const newOrderAlertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canteenId = session?.canteen_id ?? null;

  const fetchAll = useCallback(async (): Promise<void> => {
    if (!canteenId) return;
    try {
      const [ordersData, statsData, menuData, historyData] = await Promise.all([
        fetchOrders(canteenId),
        fetchStats(canteenId),
        fetchMenu(canteenId),
        fetchHistory(canteenId),
      ]);
      setOrders(ordersData);
      setStats(statsData);
      setMenu(menuData);
      setHistory(historyData);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  }, [canteenId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/staff/me");
        if (res.ok) setProfile(await res.json());
      } catch {
        // profile tab will just show session basics as fallback
      }
    })();
  }, []);

  // Initial load over HTTP — same flagged upgrade as AdminDashboard: the
  // shell no longer waits for the WS handshake to show data. WS-open
  // still resyncs on connect/reconnect.
  useEffect(() => {
    let cancelled = false;
    void fetchAll().finally(() => {
      if (!cancelled) setInitializing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  // Stop pending UI timers on unmount. Debounced stock writes survive —
  // a save the user made should still land.
  useEffect(() => {
    return () => {
      if (newOrderAlertTimer.current) clearTimeout(newOrderAlertTimer.current);
    };
  }, []);

  const handleUpdateOrderStatus = async (orderId: number, newStatus: OrderStatus): Promise<void> => {
    setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, status: newStatus } : o)));
    try {
      await updateOrderStatus(orderId, newStatus);
    } catch (error) {
      console.error("Error updating order:", error);
      void fetchAll();
    }
  };

  // Settle a cash/UPI order once the money has actually arrived. The
  // backend records who confirmed it and commits the reservation; it is
  // idempotent, so a stray double-click cannot settle twice.
  const handleConfirmPayment = useCallback(
    async (orderId: number): Promise<void> => {
      if (confirmingPaymentId) return;
      setConfirmingPaymentId(orderId);
      try {
        const response = await confirmOrderPayment(orderId);
        const data = (await response.json().catch(() => null)) as
          | { detail?: string | { message?: string } }
          | null;
        if (!response.ok) {
          const detail = data?.detail;
          alert(typeof detail === "string" ? detail : detail?.message || "Could not confirm payment");
        }
        void fetchAll();
      } catch (error) {
        console.error("Error confirming payment:", error);
        alert("Could not reach the server to confirm payment.");
      } finally {
        setConfirmingPaymentId(null);
      }
    },
    [confirmingPaymentId, fetchAll]
  );

  // Staff can now add new menu items too, same as Manager -- backend
  // already allowed this (POST /menu/create is require_staff_or_manager,
  // scoped to the staff's own assigned canteen); only this dashboard's
  // canAddItem={false} was withholding it from the UI.
  const handleAddMenuItem = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!newItem.name || !newItem.price || !newItem.stock) {
      alert("Please fill all fields");
      return;
    }

    try {
      const response = await addMenuItem({
        name: newItem.name,
        price: newItem.price,
        stock: newItem.stock,
        canteenId: canteenId,
        isVeg: newItem.is_veg,
        prepType: newItem.prep_type,
        gstRate: newItem.gst_rate,
      });

      if (response.ok) {
        setShowAddMenuModal(false);
        setNewItem({
          name: "",
          price: "",
          stock: "",
          is_veg: true,
          prep_type: "RA",
          gst_rate: "5",
        });
        void fetchAll();
      } else {
        const error = (await response.json()) as { detail?: string };
        alert(error.detail || "Failed to add menu item");
      }
    } catch (error) {
      console.error("Error adding menu item:", error);
      alert("Failed to add menu item");
    }
  };

  const handleStockUpdate = (id: number, stock: string): void => {
    if (stockTimeouts.current[id]) {
      clearTimeout(stockTimeouts.current[id]);
    }
    stockTimeouts.current[id] = setTimeout(async () => {
      try {
        await updateStockRequest(id, stock);
      } catch (error) {
        console.error("Error updating stock:", error);
      }
    }, STOCK_DEBOUNCE_MS);
  };

  useEffect(() => {
    if (!canteenId) return;

    let ws: WebSocket | undefined;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

    const connect = (): void => {
      ws = new WebSocket(`${WS}/ws/canteen/${canteenId}`);

      ws.onopen = () => {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        setWsConnected(true);
        void fetchAll();
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        const data = parseSocketEvent(event.data);
        if (!data) return;

        if (data.event === "ORDER_STATUS_UPDATE") {
          setOrders((prev) =>
            prev.map((order) => (order.order_id === data.order_id ? { ...order, status: data.status } : order))
          );
        }
        if (data.event === "STOCK_UPDATE") {
          setMenu((prev) =>
            prev.map((item) => (item.id === data.menu_item_id ? { ...item, stock: data.stock } : item))
          );
        }
        if (data.event === "ORDER_DELIVERED") {
          setOrders((prev) => prev.filter((order) => order.order_id !== data.order_id));
          void fetchAll();
        }
        if (data.event === "NEW_ORDER") {
          void fetchAll();
          setNewOrderNotification({ id: data.order_id, time: new Date().toLocaleTimeString() });
          // Clear the previous timer first — a second order arriving
          // mid-window must not be dismissed early by a stale timeout.
          if (newOrderAlertTimer.current) clearTimeout(newOrderAlertTimer.current);
          newOrderAlertTimer.current = setTimeout(
            () => setNewOrderNotification(null),
            NEW_ORDER_ALERT_MS
          );
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [canteenId, fetchAll]);

  /* ---------------- Derived (memoized) ---------------- */

  const activeOrders = useMemo(() => orders.filter((o) => o.status !== "DELIVERED"), [orders]);
  const counterOrdersCount = useMemo(
    () => activeOrders.filter((o) => o.payment_mode === "CASH").length,
    [activeOrders]
  );
  const onlineOrdersCount = useMemo(
    () => activeOrders.filter((o) => o.payment_mode !== "CASH").length,
    [activeOrders]
  );

  const filteredOrders = useMemo<Order[]>(() => {
    let filtered = activeOrders;
    if (filterType !== "ALL") {
      filtered = filtered.filter((o) => (filterType === "COUNTER" ? o.payment_mode === "CASH" : o.payment_mode !== "CASH"));
    }
    if (filterStatus !== "ALL") {
      filtered = filtered.filter((o) => o.status === filterStatus);
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (o) =>
          o.order_id.toString().includes(searchQuery) ||
          (o.student_name && o.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          o.items.some((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    return filtered;
  }, [activeOrders, filterType, filterStatus, searchQuery]);

  const filteredHistory = useMemo<HistoryEntry[]>(() => {
    if (!searchQuery) return history;
    return history.filter(
      (o) =>
        o.order_id.toString().includes(searchQuery) ||
        o.items.some((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [history, searchQuery]);

  const completedTodayCount = useMemo(
    () =>
      history.filter((h) => new Date(h.created_at).toDateString() === new Date().toDateString()).length,
    [history]
  );

  const openOrderDetails = useCallback((order: Order): void => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  }, []);

  if (!canteenId) {
    return (
      <div className="canteen-dashboard">
        <div className="session-expired">
          <p>Session expired. Please login again.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", icon: LayoutDashboard, label: "Overview" },
    { id: "active-orders", icon: BellRing, label: "Orders", badge: activeOrders.length },
    { id: "stock", icon: Package, label: "Stock" },
    { id: "history", icon: History, label: "History" },
    { id: "profile", icon: UserRound, label: "Profile" },
  ];

  const displayName = profile?.name || session?.name || "Crew member";
  const displayCanteen = profile?.canteen_name || "My Canteen";

  return (
    <AdminLayout
      canteenName={displayCanteen}
      staffName={displayName}
      onLogout={onLogout}
      tabs={tabs}
      activeTab={activeTab}
      onSelectTab={(id: string) => {
        setActiveTab(id as StaffTab);
        setSearchQuery("");
      }}
      notifications={
        <>
          {showOrderSuccess && <SuccessToast message="Order placed successfully!" />}
          <NewOrderAlert
            notification={newOrderNotification}
            onClick={() => setActiveTab("active-orders")}
            onDismiss={() => setNewOrderNotification(null)}
          />
        </>
      }
    >
      <style>{STAFF_CSS}</style>

      {initializing ? (
        <div className="sd-boot" role="status" aria-live="polite">
          <p className="sd-boot-eyebrow">Bamboo Canteen · Crew</p>
          <h2 className="sd-boot-title">Starting your shift</h2>
          <p className="sd-boot-sub">Syncing orders, menu and stock…</p>
          <span className="sd-boot-bar" aria-hidden="true" />
        </div>
      ) : (
        <>
          {!wsConnected && (
            <div className="sd-offline" role="status">
              <span className="sd-offline-dot" aria-hidden="true" />
              <span>Live updates paused — reconnecting…</span>
            </div>
          )}

          {activeTab === "overview" && (
            <OverviewTab
              stats={stats}
              activeOrdersCount={activeOrders.length}
              counterOrdersCount={counterOrdersCount}
              onlineOrdersCount={onlineOrdersCount}
              menuItemsCount={menu.length}
              completedTodayCount={completedTodayCount}
              formatCurrency={formatCurrency}
            />
          )}

          {activeTab === "active-orders" && (
            <ActiveOrdersTab
              orders={filteredOrders}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterType={filterType}
              onFilterTypeChange={(value) => setFilterType(value as OrderTypeFilter)}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
              getTimeAgo={getTimeAgo}
              onStartPreparing={(orderId: number) => handleUpdateOrderStatus(orderId, "PREPARING")}
              onViewDetails={openOrderDetails}
              onConfirmPayment={handleConfirmPayment}
              confirmingPaymentId={confirmingPaymentId}
            />
          )}

          {activeTab === "stock" && (
            <StockTab
              menu={menu}
              formatCurrency={formatCurrency}
              onStockUpdate={handleStockUpdate}
              onAddNewItem={() => setShowAddMenuModal(true)}
              canAddItem
            />
          )}

          {activeTab === "history" && (
            <HistoryTab
              history={filteredHistory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              onViewDetails={openOrderDetails}
            />
          )}

          {activeTab === "profile" && (
            <div className="sd-badge">
              {/* Sprig echo — same geometry as Header/Overview hero */}
              <svg
                className="sd-badge-sprig"
                viewBox="0 0 24 24"
                width={150}
                height={150}
                aria-hidden="true"
                focusable="false"
              >
                <g fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21V5" />
                  <path d="M12 12C8.7 12 6.6 9.9 6.2 6.6 9.5 6.6 11.6 8.7 12 12Z" />
                  <path d="M12 12c3.3 0 5.4-2.1 5.8-5.4C14.5 6.6 12.4 8.7 12 12Z" />
                  <path d="M12 17.5c-2.6 0-4.2-1.6-4.6-4.2 2.6 0 4.2 1.6 4.6 4.2Z" />
                  <path d="M12 17.5c2.6 0 4.2-1.6 4.6-4.2-2.6 0-4.2 1.6-4.6 4.2Z" />
                </g>
              </svg>

              <div className="sd-badge-head">
                <span className="sd-badge-mark" aria-hidden="true">
                  <UserRound size={21} strokeWidth={1.9} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="sd-badge-eyebrow">Canteen Crew</p>
                  <h2 className="sd-badge-name">{displayName}</h2>
                </div>
              </div>

              <div className="sd-badge-tear" aria-hidden="true">
                <span />
                <span />
              </div>

              <div className="sd-badge-rows">
                <div className="sd-badge-row">
                  <span className="sd-badge-label">Staff ID</span>
                  <span className="sd-badge-value">{profile?.staff_id || "—"}</span>
                </div>
                <div className="sd-badge-row">
                  <span className="sd-badge-label">Phone</span>
                  <span className="sd-badge-value">{profile?.phone || "—"}</span>
                </div>
                <div className="sd-badge-row">
                  <span className="sd-badge-label">Canteen</span>
                  <span className="sd-badge-value">{profile?.canteen_name || "—"}</span>
                </div>
              </div>

              <div className="sd-badge-foot">
                <p className="sd-badge-scope">Single-canteen account · scoped to your counter</p>
                {canteenId != null && (
                  <button
                    type="button"
                    className="sd-badge-edit"
                    onClick={async () => {
                      setLoadingCanteenEdit(true);
                      try {
                        const all = await fetchCanteensAdmin();
                        const mine = all.find((c) => c.id === canteenId);
                        if (mine) setEditingCanteen(mine);
                      } catch {
                        // silently ignore -- the button just won't open the modal
                      } finally {
                        setLoadingCanteenEdit(false);
                      }
                    }}
                    disabled={loadingCanteenEdit}
                  >
                    {loadingCanteenEdit ? "Loading..." : "Edit Canteen"}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {editingCanteen && (
        <EditCanteenModal
          canteen={editingCanteen}
          onClose={() => setEditingCanteen(null)}
          onUpdated={(updated) => setEditingCanteen(updated)}
        />
      )}

      {showAddMenuModal && (
        <AddMenuModal
          newItem={newItem}
          onChange={setNewItem}
          onClose={() => setShowAddMenuModal(false)}
          onSubmit={handleAddMenuItem}
        />
      )}

      {showOrderModal && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setShowOrderModal(false)}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}
    </AdminLayout>
  );
}
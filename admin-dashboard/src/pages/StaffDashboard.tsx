import { useEffect, useRef, useState } from "react";
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
import { fetchOrders, fetchStats, fetchHistory, updateOrderStatus, confirmOrderPayment } from "../modules/orders/orderService";

import StockTab from "../modules/menu/StockTab";
import { fetchMenu, updateStock as updateStockRequest } from "../modules/menu/menuService";
import EditCanteenModal from "../modules/canteens/EditCanteenModal";
import { Canteen, fetchCanteensAdmin } from "../modules/canteens/canteenService";

interface StaffDashboardProps {
  onLogout: () => void;
}

interface Profile {
  name: string;
  phone: string;
  canteen_name: string | null;
}

type StaffTab = "overview" | "active-orders" | "stock" | "history" | "profile";

// Deliberately simple, large-button single-canteen shell for a Staff
// account. Reuses the same Overview/ActiveOrders/Stock/History module
// components AdminDashboard.jsx uses (same order/menu/websocket business
// logic — nothing about how orders/stock work was changed here), but the
// navigation chrome is intentionally smaller: no Counter, no Insights, no
// Add Canteen, no Staff Management, no canteen switcher. The staff member's
// canteen comes only from their own session/profile — never user-selectable.
export default function StaffDashboard({ onLogout }: StaffDashboardProps) {
  const session = getSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<StaffTab>("overview");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [newOrderNotification, setNewOrderNotification] = useState<{ id: number; time: string } | null>(null);
  const [showOrderSuccess] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(null);
  const [editingCanteen, setEditingCanteen] = useState<Canteen | null>(null);
  const [loadingCanteenEdit, setLoadingCanteenEdit] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const stockTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const canteenId = session?.canteen_id ?? null;

  const fetchAll = async () => {
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
  };

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

  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, status: newStatus } : o)));
    try {
      await updateOrderStatus(orderId, newStatus);
    } catch (error) {
      console.error("Error updating order:", error);
      fetchAll();
    }
  };

  // Settle a cash/UPI order once the money has actually arrived. The
  // backend records who confirmed it and commits the reservation; it is
  // idempotent, so a stray double-click cannot settle twice.
  const handleConfirmPayment = async (orderId: number) => {
    if (confirmingPaymentId) return;
    setConfirmingPaymentId(orderId);
    try {
      const response = await confirmOrderPayment(orderId);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = data?.detail;
        alert(typeof detail === "string" ? detail : detail?.message || "Could not confirm payment");
      }
      fetchAll();
    } catch (error) {
      console.error("Error confirming payment:", error);
      alert("Could not reach the server to confirm payment.");
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const handleStockUpdate = (id: number, stock: string) => {
    if (stockTimeouts.current[id]) {
      clearTimeout(stockTimeouts.current[id]);
    }
    stockTimeouts.current[id] = setTimeout(async () => {
      try {
        await updateStockRequest(id, stock);
      } catch (error) {
        console.error("Error updating stock:", error);
      }
    }, 400);
  };

  useEffect(() => {
    if (!canteenId) return;

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(`${WS}/ws/canteen/${canteenId}`);

      ws.onopen = () => {
        clearTimeout(reconnectTimeout);
        fetchAll();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

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
          fetchAll();
        }
        if (data.event === "NEW_ORDER") {
          fetchAll();
          setNewOrderNotification({ id: data.order_id, time: new Date().toLocaleTimeString() });
          setTimeout(() => setNewOrderNotification(null), 5000);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      clearTimeout(reconnectTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canteenId]);

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getTimeAgo = (timestamp: string) => {
    if (!timestamp) return "Just now";
    const diffMins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago`;
  };

  const formatDate = (timestamp: string) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!canteenId) {
    return (
      <div className="canteen-dashboard">
        <div className="session-expired">
          <p>Session expired. Please login again.</p>
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => o.status !== "DELIVERED");
  const counterOrdersCount = activeOrders.filter((o) => o.payment_mode === "CASH").length;
  const onlineOrdersCount = activeOrders.filter((o) => o.payment_mode !== "CASH").length;

  const getFilteredOrders = () => {
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
          o.items.some((item: any) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    return filtered;
  };

  const getFilteredHistory = () => {
    if (!searchQuery) return history;
    return history.filter(
      (o) =>
        o.order_id.toString().includes(searchQuery) ||
        o.items.some((item: any) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const completedTodayCount = history.filter((h) => {
    const orderDate = new Date(h.created_at).toDateString();
    return orderDate === new Date().toDateString();
  }).length;

  const tabs = [
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "active-orders", icon: "🔔", label: "Orders", badge: activeOrders.length },
    { id: "stock", icon: "📦", label: "Stock" },
    { id: "history", icon: "📜", label: "History" },
    { id: "profile", icon: "👤", label: "Profile" },
  ];

  const openOrderDetails = (order: any) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  return (
    <AdminLayout
      canteenName={profile?.canteen_name || "My Canteen"}
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
          orders={getFilteredOrders()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
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
        <StockTab menu={menu} formatCurrency={formatCurrency} onStockUpdate={handleStockUpdate} canAddItem={false} />
      )}

      {activeTab === "history" && (
        <HistoryTab
          history={getFilteredHistory()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
          onViewDetails={openOrderDetails}
        />
      )}

      {activeTab === "profile" && (
        <div className="section-header">
          <div>
            <h2>Profile</h2>
            <p>Name: {profile?.name || session?.name}</p>
            <p>Phone: {profile?.phone || "—"}</p>
            <p>Canteen: {profile?.canteen_name || "—"}</p>
          </div>
          {canteenId != null && (
            <button
              type="button"
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
      )}

      {editingCanteen && (
        <EditCanteenModal
          canteen={editingCanteen}
          onClose={() => setEditingCanteen(null)}
          onUpdated={(updated) => setEditingCanteen(updated)}
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

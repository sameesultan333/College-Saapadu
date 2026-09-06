import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Bell, History, LayoutDashboard, Lightbulb, Package, ShoppingCart } from "lucide-react";

import { WS } from "../config/api";

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

import CounterTab from "../modules/counter/CounterTab";
import PaymentModal from "../modules/counter/PaymentModal";
import GuestDetailsModal from "../modules/counter/GuestDetailsModal";
import OrderVerificationModal from "../modules/counter/OrderVerificationModal";
import { placeOrder, clearCheckoutKey } from "../modules/counter/counterService";

import StockTab from "../modules/menu/StockTab";
import AddMenuModal from "../modules/menu/AddMenuModal";
import {
  fetchMenu,
  updateStock as updateStockRequest,
  addMenuItem,
  deleteMenuItem,
} from "../modules/menu/menuService";

import InsightsTab from "../modules/insights/InsightsTab";
import { analyzeMenuPredictions } from "../modules/insights/mlPredictor";

import { parseSocketEvent } from "../types";
import type {
  CanteenId,
  CanteenStats,
  CartItem,
  Guest,
  HistoryEntry,
  MenuItem,
  MenuPrediction,
  NewMenuItemForm,
  Order,
  OrderPlacementPayload,
  OrderPlacementResponse,
  OrderStatus,
  OrderVerificationInfo,
  PaymentMode,
  PerformanceMetrics,
  TabDefinition,
  TabId,
} from "../types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface AdminDashboardProps {
  /** CanteenId is `number` in ../types — widen the alias there if the manager grid passes string ids. */
  canteenId: CanteenId;
  canteenName: string;
  onBack: () => void;
  onLogout: () => void;
}

type OrderTypeFilter = "ALL" | "COUNTER" | "ONLINE";

interface NewOrderNotification {
  id: number;
  time: string;
}

/** One read of the checkout body: the success shape on the ok path, plus
 *  the error `detail` that is only read on the failure path — matching the
 *  original implementation's single `response.json()` call. */
type CheckoutResponse = OrderPlacementResponse & {
  detail?: string | { message?: string };
};

type PaymentErrorBody = { detail?: string | { message?: string } } | null;

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const STOCK_DEBOUNCE_MS = 400;
const SUCCESS_TOAST_MS = 3000;
const NEW_ORDER_ALERT_MS = 5000;
const WS_RECONNECT_DELAY_MS = 3000;

/* ------------------------------------------------------------------ */
/* Module-scope pure helpers — referentially stable forever, so        */
/* memoized children (OrderCard, OrderRow, …) actually skip renders.   */
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

/** Soft two-tone chime (E5 → A5) synthesized locally — no network asset,
 *  no CORS, no hotlink 404s. Autoplay-blocked contexts stay silent. */
const playNewOrderChime = (): void => {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    void ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.05;
    master.connect(ctx.destination);

    [659.25, 880].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * 0.15;

      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + 0.55);
    });

    window.setTimeout(() => void ctx.close().catch(() => {}), 1000);
  } catch {
    /* audio unavailable — silent fallback is correct here */
  }
};

/* ------------------------------------------------------------------ */
/* Overlay styles — boot screen + offline banner only. Namespaced      */
/* "adb-", consumes --bc-* tokens exclusively.                         */
/* ------------------------------------------------------------------ */

const ADMIN_DASHBOARD_CSS = `
.adb-boot{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:46vh;padding:var(--bc-space-32) var(--bc-space-16);text-align:center}
.adb-boot-eyebrow{font-size:var(--bc-font-size-eyebrow);font-weight:var(--bc-font-weight-eyebrow);letter-spacing:var(--bc-letter-spacing-eyebrow);text-transform:uppercase;color:var(--bc-color-brand-accent-strong)}
.adb-boot-title{margin-top:var(--bc-space-8);font-size:var(--bc-font-size-page-heading);font-weight:var(--bc-font-weight-page-heading);letter-spacing:var(--bc-letter-spacing-tight);color:var(--bc-color-text-primary)}
.adb-boot-sub{margin-top:var(--bc-space-4);font-size:var(--bc-font-size-secondary);color:var(--bc-color-text-muted)}
.adb-boot-bar{position:relative;overflow:hidden;width:180px;height:3px;margin-top:var(--bc-space-24);border-radius:var(--bc-radius-pill);background:var(--bc-color-neutral-bg-strong)}
.adb-boot-bar::after{content:"";position:absolute;top:0;bottom:0;left:0;width:40%;border-radius:inherit;background:var(--bc-color-brand-primary);animation:adb-sweep 1.1s var(--bc-motion-easing-standard) infinite}
@keyframes adb-sweep{from{transform:translateX(-110%)}to{transform:translateX(360%)}}

.adb-offline{display:flex;align-items:center;justify-content:center;gap:var(--bc-space-8);margin-bottom:var(--bc-space-16);padding:9px var(--bc-space-16);border:1px solid var(--bc-color-warning-border);border-radius:var(--bc-radius-md);background:var(--bc-color-warning-bg);color:var(--bc-color-warning-strong);font-size:var(--bc-font-size-secondary);font-weight:600}
.adb-offline-dot{flex:none;width:8px;height:8px;border-radius:var(--bc-radius-round);background:var(--bc-color-warning-light);animation:adb-blink 1.4s ease-in-out infinite}
@keyframes adb-blink{0%,100%{opacity:1}50%{opacity:.35}}
`;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/**
 * Top-level orchestrator for the Kitchen Dashboard. Owns all cross-tab state
 * (orders/menu/stats/history/websocket/cart/etc.) and composes AdminLayout +
 * the active feature module. No API calls, business rules or visuals were
 * changed — the code was split by feature (src/modules, src/layouts) and typed.
 *
 * This is the Manager's per-canteen operational dashboard: the canteen to
 * operate on is chosen from ManagerDashboard's canteen grid and passed down
 * as props. `onBack` returns to that grid; `onLogout` is provided by App and
 * already handles clearing the session.
 */
export default function AdminDashboard({ canteenId, canteenName, onBack, onLogout }: AdminDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<CanteenStats | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [mlPredictions, setMlPredictions] = useState<MenuPrediction[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [counterCart, setCounterCart] = useState<CartItem[]>([]);
  const [showGuestDetailsModal, setShowGuestDetailsModal] = useState(false);
  const [counterGuest, setCounterGuest] = useState<Guest | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode | "">("");
  const [cashReceived, setCashReceived] = useState("");
  const [orderVerification, setOrderVerification] = useState<OrderVerificationInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "ALL">("ALL");
  const [filterType, setFilterType] = useState<OrderTypeFilter>("ALL");
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [newOrderNotification, setNewOrderNotification] = useState<NewOrderNotification | null>(null);
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [newItem, setNewItem] = useState<NewMenuItemForm>({
    name: "",
    price: "",
    stock: "",
    is_veg: true,
    prep_type: "RA",
    gst_rate: "5",
  });

  const stockTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const placingOrderRef = useRef(false);
  const newOrderAlertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      const { predictions, performanceMetrics: metrics } = analyzeMenuPredictions(menuData, historyData);
      setMlPredictions(predictions);
      setPerformanceMetrics(metrics);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  }, [canteenId]);

  // Initial load over HTTP — the dashboard no longer waits for the WebSocket
  // handshake to show data. The WS-open fetch below still resyncs on
  // connect/reconnect exactly as before; a benign double-fetch on mount.
  useEffect(() => {
    let cancelled = false;
    void fetchAll().finally(() => {
      if (!cancelled) setInitializing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  // Hygiene: stop pending UI timers on unmount. Debounced stock writes are
  // intentionally NOT cancelled — a save the user made should still land.
  useEffect(() => {
    return () => {
      if (newOrderAlertTimer.current) clearTimeout(newOrderAlertTimer.current);
      if (successToastTimer.current) clearTimeout(successToastTimer.current);
    };
  }, []);

  const handleUpdateOrderStatus = useCallback(
    async (orderId: number, newStatus: OrderStatus): Promise<void> => {
      // Optimistic Update
      setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, status: newStatus } : o)));

      try {
        await updateOrderStatus(orderId, newStatus);
      } catch (error) {
        console.error("Error updating order:", error);
        // Rollback or refetch
        void fetchAll();
      }
    },
    [fetchAll]
  );

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
        void fetchAll(); // Refresh menu
      } else {
        const error = (await response.json()) as { detail?: string };
        alert(error.detail || "Failed to add menu item");
      }
    } catch (error) {
      console.error("Error adding menu item:", error);
      alert("Failed to add menu item");
    }
  };

  // Settle a cash/UPI order once staff confirm the money actually
  // arrived. The backend records who confirmed it and commits the
  // inventory reservation; it is idempotent, so a stray double-click
  // cannot settle twice.
  const handleConfirmPayment = useCallback(
    async (orderId: number): Promise<void> => {
      if (confirmingPaymentId) return;
      setConfirmingPaymentId(orderId);
      try {
        const response = await confirmOrderPayment(orderId);
        const data = (await response.json().catch(() => null)) as PaymentErrorBody;
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

  const handleDeleteMenuItem = async (item: MenuItem): Promise<void> => {
    const confirmed = window.confirm(`Permanently delete "${item.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const response = await deleteMenuItem(item.id);
      if (response.ok) {
        setMenu((prev) => prev.filter((m) => m.id !== item.id));
      } else {
        const error = (await response.json().catch(() => null)) as { detail?: string } | null;
        alert(error?.detail || "Failed to delete item");
      }
    } catch (error) {
      console.error("Error deleting menu item:", error);
      alert("Failed to delete item");
    }
  };

  const addToCounterCart = (item: MenuItem): void => {
    if (item.stock <= 0) {
      alert(`${item.name} is out of stock!`);
      return;
    }
    const existing = counterCart.find((c) => c.id === item.id);
    if (existing) {
      if (existing.quantity >= item.stock) {
        alert(`Only ${item.stock} units available for ${item.name}`);
        return;
      }
      setCounterCart(counterCart.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCounterCart([...counterCart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCounterCart = (itemId: number): void => {
    setCounterCart(counterCart.filter((c) => c.id !== itemId));
  };

  const updateCounterCartQuantity = (itemId: number, quantity: number): void => {
    const item = menu.find((m) => m.id === itemId);
    if (!item) return;
    if (quantity > item.stock) {
      alert(`Only ${item.stock} units available`);
      return;
    }
    if (quantity <= 0) {
      removeFromCounterCart(itemId);
    } else {
      setCounterCart(counterCart.map((c) => (c.id === itemId ? { ...c, quantity } : c)));
    }
  };

  const initiateCounterOrder = (): void => {
    if (counterCart.length === 0) {
      alert("Please add items to cart");
      return;
    }
    // Walk-in flow: collect the guest's identity before payment (see
    // CLAUDE.md's walk-in customer notes) rather than a hardcoded user_id.
    setShowGuestDetailsModal(true);
  };

  const handleGuestCreated = (guest: Guest): void => {
    setCounterGuest(guest);
    setShowGuestDetailsModal(false);
    setShowPaymentModal(true);
  };

  const getCartTotal = (): number => {
    return counterCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getChange = (): number => {
    const total = getCartTotal();
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, received - total);
  };

  const placeCounterOrder = async (): Promise<void> => {
    // Guard against a second submission from a double tap, an Enter
    // keypress or a re-render while the first request is still in
    // flight. This is UX-level only -- the real protection is the
    // durable Idempotency-Key enforced by the database.
    if (placingOrderRef.current) return;

    if (!paymentMethod) {
      alert("Please select payment method");
      return;
    }

    if (paymentMethod === "CASH") {
      const total = getCartTotal();
      const received = parseFloat(cashReceived);
      if (!cashReceived || received < total) {
        alert("Please enter correct cash amount");
        return;
      }
    }

    if (!counterGuest) {
      alert("Missing walk-in customer details. Please start again.");
      return;
    }

    placingOrderRef.current = true;

    try {
      const payload: OrderPlacementPayload = {
        guest_id: counterGuest.id,
        payment_mode: paymentMethod,
        canteens: [
          {
            canteen_id: canteenId,
            items: counterCart.map((item) => ({
              menu_item_id: item.id,
              quantity: item.quantity,
            })),
          },
        ],
      };

      const response = await placeOrder(payload);
      const data = (await response.json()) as CheckoutResponse;

      if (response.ok) {
        const placedOrder = data.orders[0];
        setOrderVerification({
          orderId: placedOrder.order_id,
          guestCode: data.guest_code,
          verificationToken: placedOrder.verification_token,
        });
        setShowOrderSuccess(true);
        if (successToastTimer.current) clearTimeout(successToastTimer.current);
        successToastTimer.current = setTimeout(() => setShowOrderSuccess(false), SUCCESS_TOAST_MS);
        setCounterCart([]);
        setCounterGuest(null);
        setShowPaymentModal(false);
        setPaymentMethod("");
        setCashReceived("");
        // Definitive success -- this checkout attempt is finished, so the
        // next order gets a fresh key.
        clearCheckoutKey();
        void fetchAll();
      } else {
        // A definitive rejection from the server (validation, stock,
        // tenancy). Retrying this exact attempt would fail again, so the
        // key is retired and staff can start a clean attempt.
        clearCheckoutKey();
        const detail = data?.detail;
        alert(typeof detail === "string" ? detail : detail?.message || "Order failed");
      }
    } catch (error) {
      // UNKNOWN OUTCOME -- the request may well have succeeded and only
      // the response was lost. We must NOT tell staff the order failed,
      // and must NOT clear the key: pressing Place Order again reuses it,
      // so the server returns the original order instead of a duplicate.
      console.error("Error placing order:", error);
      alert(
        "Could not confirm the order with the server.\n\n" +
          "It may have gone through. Press Confirm Order again — the system " +
          "will return the existing order rather than creating a duplicate."
      );
    } finally {
      placingOrderRef.current = false;
    }
  };

  useEffect(() => {
    if (!canteenId) return;

    let ws: WebSocket | undefined;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

    const connect = (): void => {
      console.log("🔄 Attempting to connect to WebSocket...");
      ws = new WebSocket(`${WS}/ws/canteen/${canteenId}`);

      ws.onopen = () => {
        console.log("✅ WebSocket connected to Canteen:", canteenId);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        setWsConnected(true);
        void fetchAll(); // Synchronize on connect
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        const data = parseSocketEvent(event.data);
        if (!data) return;
        console.log("WS EVENT:", data);

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

        if (data.event === "ETA_UPDATE") {
          setOrders((prev) =>
            prev.map((order) =>
              order.order_id === data.order_id
                ? {
                    ...order,
                    estimated_wait_time: data.estimated_wait_time,
                    estimated_ready_at: data.estimated_ready_at,
                  }
                : order
            )
          );
        }

        if (data.event === "ORDER_DELIVERED") {
          setOrders((prev) => prev.filter((order) => order.order_id !== data.order_id));
          void fetchAll(); // Refresh stats/history too
        }

        if (data.event === "PICKUP_QUEUE_UPDATE") {
          setOrders((prev) =>
            prev.map((order) =>
              order.order_id === data.order_id
                ? {
                    ...order,
                    people_in_line: data.people_in_line,
                    estimated_ready_at: data.estimated_ready_at,
                  }
                : order
            )
          );
        }

        if (data.event === "NEW_ORDER") {
          console.log("🔥 NEW ORDER RECEIVED!");
          // Trigger fetchAll to get full order details and update stats
          void fetchAll();

          // Show notification. Clear the previous timer first: without this,
          // a second order arriving mid-window gets dismissed early by the
          // first order's stale timeout.
          setNewOrderNotification({
            id: data.order_id,
            time: new Date().toLocaleTimeString(),
          });
          if (newOrderAlertTimer.current) clearTimeout(newOrderAlertTimer.current);
          newOrderAlertTimer.current = setTimeout(() => setNewOrderNotification(null), NEW_ORDER_ALERT_MS);

          playNewOrderChime();
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
      };

      ws.onclose = (e) => {
        console.log("⚠️ WebSocket disconnected. Reconnecting in 3s...", e.reason);
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.onclose = null; // Prevent reconnection loop on unmount
        ws.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [canteenId, fetchAll]);

  /* ---------------- Derived data (memoized) ---------------- */

  const activeOrders = useMemo(() => orders.filter((o) => o.status !== "DELIVERED"), [orders]);
  const counterOrders = useMemo(() => activeOrders.filter((o) => o.payment_mode === "CASH"), [activeOrders]);
  const onlineOrders = useMemo(
    () => activeOrders.filter((o) => o.payment_mode !== "CASH"),
    [activeOrders]
  );

  const filteredOrders = useMemo<Order[]>(() => {
    let filtered = activeOrders;

    if (filterType !== "ALL") {
      filtered = filtered.filter((o) =>
        filterType === "COUNTER" ? o.payment_mode === "CASH" : o.payment_mode !== "CASH"
      );
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

  /* ---------------- Handlers ---------------- */

  const startPreparing = useCallback(
    (orderId: number) => handleUpdateOrderStatus(orderId, "PREPARING"),
    [handleUpdateOrderStatus]
  );

  const openOrderDetails = useCallback((order: Order): void => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  }, []);

  const handleSelectTab = (tabId: TabId): void => {
    setActiveTab(tabId);
    setSearchQuery("");
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

  const tabs: TabDefinition[] = [
    { id: "overview", icon: LayoutDashboard, label: "Overview" },
    { id: "active-orders", icon: Bell, label: "Active Orders", badge: activeOrders.length },
    { id: "counter", icon: ShoppingCart, label: "Counter", badge: counterCart.length },
    { id: "stock", icon: Package, label: "Stock" },
    { id: "history", icon: History, label: "History" },
    { id: "insights", icon: Lightbulb, label: "Insights" },
  ];

  return (
    <AdminLayout
      canteenName={canteenName}
      onLogout={onLogout}
      onBack={onBack}
      tabs={tabs}
      activeTab={activeTab}
      onSelectTab={(id) => handleSelectTab(id as TabId)}
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
      <style>{ADMIN_DASHBOARD_CSS}</style>

      {initializing ? (
        <div className="adb-boot" role="status" aria-live="polite">
          <p className="adb-boot-eyebrow">College Saapaadu</p>
          <h2 className="adb-boot-title">Setting up your kitchen</h2>
          <p className="adb-boot-sub">Syncing orders, menu and stock…</p>
          <span className="adb-boot-bar" aria-hidden="true" />
        </div>
      ) : (
        <>
          {!wsConnected && (
            <div className="adb-offline" role="status">
              <span className="adb-offline-dot" aria-hidden="true" />
              <span>Live updates paused — reconnecting…</span>
            </div>
          )}

          {activeTab === "overview" && (
            <OverviewTab
              stats={stats}
              activeOrdersCount={activeOrders.length}
              counterOrdersCount={counterOrders.length}
              onlineOrdersCount={onlineOrders.length}
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
              onStartPreparing={startPreparing}
              onViewDetails={openOrderDetails}
              onConfirmPayment={handleConfirmPayment}
              confirmingPaymentId={confirmingPaymentId}
            />
          )}

          {activeTab === "counter" && (
            <CounterTab
              menu={menu}
              cart={counterCart}
              onAddToCart={addToCounterCart}
              onUpdateQuantity={updateCounterCartQuantity}
              onRemoveFromCart={removeFromCounterCart}
              getCartTotal={getCartTotal}
              formatCurrency={formatCurrency}
              onProceedToPayment={initiateCounterOrder}
            />
          )}

          {activeTab === "stock" && (
            <StockTab
              menu={menu}
              formatCurrency={formatCurrency}
              onStockUpdate={handleStockUpdate}
              onAddNewItem={() => setShowAddMenuModal(true)}
              onDeleteItem={handleDeleteMenuItem}
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

          {activeTab === "insights" && (
            <InsightsTab
              predictions={mlPredictions}
              performanceMetrics={performanceMetrics}
              formatCurrency={formatCurrency}
            />
          )}
        </>
      )}

      {showGuestDetailsModal && (
        <GuestDetailsModal onClose={() => setShowGuestDetailsModal(false)} onCreated={handleGuestCreated} />
      )}

      {showPaymentModal && (
        <PaymentModal
          cart={counterCart}
          paymentMethod={paymentMethod as PaymentMode}
          onSelectPaymentMethod={setPaymentMethod}
          cashReceived={cashReceived}
          onCashReceivedChange={setCashReceived}
          getCartTotal={getCartTotal}
          getChange={getChange}
          formatCurrency={formatCurrency}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={placeCounterOrder}
          showWallet={false}
        />
      )}

      {orderVerification && (
        <OrderVerificationModal
          orderId={orderVerification.orderId}
          guestCode={orderVerification.guestCode}
          verificationToken={orderVerification.verificationToken}
          onClose={() => setOrderVerification(null)}
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
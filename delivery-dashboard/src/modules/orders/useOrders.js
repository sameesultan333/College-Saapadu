import { useCallback, useEffect, useRef, useState } from "react";
import { WS as WS_BASE } from "../../config/api";
import { apiGet, apiPut } from "../../services/apiClient";

/**
 * Owns the order list for a canteen: fetching, the live WebSocket sync
 * that keeps it fresh, and the status-update mutations used by the
 * dashboard. Also surfaces a transient `newOrderInfo` notification for
 * incoming realtime events (rendered by <NotificationToast/>).
 */
export default function useOrders(canteenId, canteenName) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newOrderInfo, setNewOrderInfo] = useState(null);

  const wsRef = useRef(null);

  const fetchOrders = useCallback(async () => {
    if (!canteenId) return;
    try {
      const data = await apiGet(`/orders/canteen/${canteenId}`);

      const ordersWithDetails = data
        .filter(o => ["PREPARING", "READY"].includes(o.status))
        .map(order => ({
          order_id: order.order_id,
          canteen_id: order.canteen_id ?? canteenId,
          canteen_name: order.canteen_name ?? canteenName,
          status: order.status,
          payment_mode: order.payment_mode ?? "UNKNOWN",
          items: order.items ?? [],
          student_name: order.student_name ?? "Customer",
          customer_category: order.customer_category ?? "STUDENT",
          phone: order.phone ?? null,
          location: order.location ?? "Campus",
          created_at: order.created_at ?? new Date().toISOString()
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setOrders(ordersWithDetails);
    } catch (err) {
      console.error("Fetch Orders Error:", err);
    }
  }, [canteenId, canteenName]);

  /* ================= REALTIME WEBSOCKET ================= */
  useEffect(() => {
    if (!canteenId) return;

    let ws;
    let reconnectTimeout;

    const connect = () => {
      console.log("🔄 Connecting to kitchen sync...");
      ws = new WebSocket(`${WS_BASE}/ws/canteen/${canteenId}`);

      ws.onopen = () => {
        console.log("✅ Live Sync Connected");
        clearTimeout(reconnectTimeout);
        fetchOrders();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("📦 Sync event:", data);

        // Notify if it's a new relevant event
        if (data.event === "ORDER_STATUS_UPDATE" || data.event === "NEW_ORDER") {
          // Provide a notification for delivery staff
          setNewOrderInfo({
            id: data.order_id,
            status: data.status || "NEW",
            time: new Date().toLocaleTimeString()
          });

          // Sound alert
          try {
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
            audio.play();
          } catch (e) { console.log(e); }

          setTimeout(() => setNewOrderInfo(null), 6000);
        }

        // Always fetch the freshest state from backend
        fetchOrders();
      };

      ws.onclose = () => {
        console.log("⚠️ Disconnected from kitchen. Reconnecting...");
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
  }, [canteenId, fetchOrders]);

  /* ================= ACTIONS ================= */
  const updateStatus = async (id, status) => {
    setLoading(true);
    try {
      await apiPut("/order/update-status", { order_id: id, status });

      await fetchOrders();
      return true;
    } catch (err) {
      alert("Failed to update status. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const markReady = async (order) => {
    setLoading(true);
    try {
      await apiPut("/order/update-status", { order_id: order.order_id, status: "READY" });
      await fetchOrders();
      return true;
    } catch (err) {
      alert("Failed to mark as ready.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const preparingOrders = orders.filter(o => o.status === "PREPARING");
  const readyOrders = orders.filter(o => o.status === "READY");

  return {
    orders,
    preparingOrders,
    readyOrders,
    loading,
    newOrderInfo,
    dismissNewOrderInfo: () => setNewOrderInfo(null),
    fetchOrders,
    updateStatus,
    markReady,
  };
}

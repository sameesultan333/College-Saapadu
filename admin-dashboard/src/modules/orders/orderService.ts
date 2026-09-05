import { apiFetch, apiGet } from "../../services/apiClient";

// All four GET endpoints and the status update require an authenticated
// Manager/Staff (or, for fetchOrders, Delivery) token -- see
// backend/modules/orders/router.py and modules/admin/router.py. Endpoint
// paths/payloads are unchanged from the original AdminDashboard.jsx
// implementation (CLAUDE.md section 30); only the transport moved from a
// bare unauthenticated fetch() to apiFetch/apiGet so the bearer token is
// attached and a 401 is retried via refresh, same as every other service
// module in this app (canteenService.ts, menuService.js).

export async function fetchOrders(canteenId: number): Promise<any[]> {
  return apiGet(`/orders/canteen/${canteenId}`);
}

export async function fetchStats(canteenId: number): Promise<any> {
  return apiGet(`/admin/stats/${canteenId}`);
}

export async function fetchHistory(canteenId: number): Promise<any[]> {
  return apiGet(`/orders/history/${canteenId}`);
}

export async function updateOrderStatus(orderId: number, newStatus: string): Promise<Response> {
  const res = await apiFetch(`/admin/order/status?order_id=${orderId}&status=${newStatus}`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error("Status update failed");
  return res;
}

// Staff confirms cash/UPI money actually arrived -- see
// backend/modules/payments/router.py POST /payments/order/{id}/confirm.
// Returns the raw Response (not parsed): callers read both the success
// body and the `detail` on a failure response, matching the same pattern
// confirmOrderPayment's callers already use for placeOrder/updateStock.
export async function confirmOrderPayment(orderId: number): Promise<Response> {
  return apiFetch(`/payments/order/${orderId}/confirm`, { method: "POST" });
}

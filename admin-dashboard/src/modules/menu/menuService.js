import { apiFetch } from "../../services/apiClient";

// Extracted from AdminDashboard.jsx. `updateStock` keeps the original
// per-item debounce behavior (400ms) via a shared timeout map owned by the
// caller (see StockTab.jsx), matching the previous `stockTimeouts` ref.
// Now routed through apiFetch since these endpoints require a manager/staff
// (update-stock) or manager-only (create) bearer token.
export async function fetchMenu(canteenId) {
  const res = await apiFetch(`/menu/${canteenId}`);
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json();
}

export async function updateStock(id, stock) {
  return apiFetch(`/menu/update-stock`, {
    method: "PUT",
    body: JSON.stringify({ menu_item_id: id, stock: Number(stock) || 0 }),
  });
}

export async function deleteMenuItem(id) {
  return apiFetch(`/menu/${id}`, { method: "DELETE" });
}

export async function addMenuItem({ name, price, stock, canteenId, isVeg, prepType, gstRate }) {
  const queryParams = new URLSearchParams({
    name,
    price,
    stock,
    canteen_id: canteenId,
    is_veg: isVeg,
    prep_type: prepType,
    gst_rate: gstRate ?? 5,
  }).toString();

  return apiFetch(`/menu/create?${queryParams}`, { method: "POST" });
}

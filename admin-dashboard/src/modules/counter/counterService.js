import { apiFetch } from "../../services/apiClient";

// One logical checkout attempt = one idempotency key.
//
// The key is persisted in localStorage, NOT component state, so it
// survives a page refresh, a crashed tab or a restarted browser. A retry
// after "the server went away and I don't know what happened" reuses the
// SAME key, so the backend returns the original order instead of creating
// another one. The key is only cleared once the backend gives a definitive
// answer, or when staff deliberately start a new order.
const KEY_STORAGE = "counter_checkout_key";

function newKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `ck-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Key for the current checkout attempt, creating one if none is held. */
export function getCheckoutKey() {
  try {
    let key = localStorage.getItem(KEY_STORAGE);
    if (!key) {
      key = newKey();
      localStorage.setItem(KEY_STORAGE, key);
    }
    return key;
  } catch {
    // Private mode / storage blocked: still better than no key at all.
    return newKey();
  }
}

/** Call ONLY after a definitive result, or when starting a new order. */
export function clearCheckoutKey() {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export async function placeOrder(payload) {
  // Was a raw fetch() with no Authorization header -- /order/place requires
  // a bearer token (get_current_account in backend/auth.py) to identify the
  // manager/staff placing this counter/walk-in order, so every call here was
  // rejected with 401 regardless of who was logged in. apiFetch attaches the
  // session's access_token and retries once via /staff/refresh on a 401,
  // same as every other authenticated admin-dashboard call.
  const response = await apiFetch("/order/place", {
    method: "POST",
    headers: {
      "Idempotency-Key": getCheckoutKey(),
    },
    body: JSON.stringify(payload),
  });
  return response;
}

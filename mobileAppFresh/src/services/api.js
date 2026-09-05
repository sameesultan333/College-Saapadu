import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./config";
import { authFetch } from "./auth";
const API = API_URL;

// One logical checkout attempt = one idempotency key, held in AsyncStorage
// (not component state) so it survives a killed app, a crashed screen or a
// dropped connection. A retry after "the request failed and I don't know
// why" reuses the SAME key, so the backend returns the original order
// instead of creating a duplicate -- see CLAUDE.md's checkout idempotency
// notes and admin-dashboard's counterService.js, which uses the same
// pattern for counter orders. The key is only cleared once the backend
// gives a definitive answer (success or a real rejection), never on a
// network failure where the outcome is unknown.
const CHECKOUT_KEY_STORAGE = "checkout_idempotency_key";

function newCheckoutKey() {
  return `mob-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function getCheckoutKey() {
  try {
    let key = await AsyncStorage.getItem(CHECKOUT_KEY_STORAGE);
    if (!key) {
      key = newCheckoutKey();
      await AsyncStorage.setItem(CHECKOUT_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return newCheckoutKey();
  }
}

/** Call ONLY after a definitive result (success or rejection). */
async function clearCheckoutKey() {
  try {
    await AsyncStorage.removeItem(CHECKOUT_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

// Always tenant-scoped: a logged-in customer's canteen list must never be
// requested without their college_id, or the backend returns every
// college's canteens (see backend/modules/canteens/router.py GET /canteens).
// Callers must resolve college_id from the authenticated session before
// calling this -- there is no "fetch everything" fallback here on purpose.
export async function getCanteens(collegeId) {
  const res = await fetch(`${API}/canteens?college_id=${collegeId}`);
  if (!res.ok) throw new Error("Failed to fetch canteens");
  return res.json();
}

// Single-college lookup (public) -- used to resolve a known college_id's
// display name without loading every college on the platform.
export async function getCollege(collegeId) {
  const res = await fetch(`${API}/colleges/${collegeId}`);
  if (!res.ok) throw new Error("Failed to fetch college");
  return res.json();
}

/* ---------------- HOME-SCREEN CACHE ----------------
 * Cache-first paint for the canteen list + college name, keyed per college
 * so switching accounts/colleges can never show a stale cache from a
 * different tenant. Not a general cache layer -- just enough to avoid a
 * blank/skeleton screen on every app open while the authoritative fetch
 * refreshes in the background.
 */
function canteensCacheKey(collegeId) {
  return `cache_canteens_${collegeId}`;
}
function collegeCacheKey(collegeId) {
  return `cache_college_${collegeId}`;
}

export async function getCachedCanteens(collegeId) {
  try {
    const raw = await AsyncStorage.getItem(canteensCacheKey(collegeId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function cacheCanteens(collegeId, data) {
  try {
    await AsyncStorage.setItem(canteensCacheKey(collegeId), JSON.stringify(data));
  } catch {
    /* best-effort cache -- a failed write must never block the screen */
  }
}

export async function getCachedCollegeName(collegeId) {
  try {
    const raw = await AsyncStorage.getItem(collegeCacheKey(collegeId));
    return raw ? JSON.parse(raw).name : null;
  } catch {
    return null;
  }
}

export async function cacheCollege(collegeId, data) {
  try {
    await AsyncStorage.setItem(collegeCacheKey(collegeId), JSON.stringify(data));
  } catch {
    /* best-effort cache */
  }
}

export async function getMenu(canteenId) {
  const res = await fetch(`${API}/menu/${canteenId}`);
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json();
}



export async function placeBatchOrder(payload) {
  const key = await getCheckoutKey();

  let res;
  try {
    res = await authFetch(`${API}/order/place`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    // The request may well have reached the server and succeeded --
    // only the response was lost. Do NOT clear the key: pressing Place
    // Order again reuses it, so the server returns the existing order
    // instead of creating a duplicate.
    const err = new Error(
      "Could not confirm the order with the server. It may have gone " +
        "through -- press Place Order again to check."
    );
    err.unknownOutcome = true;
    throw err;
  }

  if (!res.ok) {
    // A definitive rejection (validation, stock, tenancy). Retrying this
    // exact attempt would fail again, so the key is retired and the
    // customer can start a genuinely new attempt.
    await clearCheckoutKey();
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message || "Order failed");
  }

  // Definitive success -- this checkout attempt is finished, so the next
  // order gets a fresh key.
  await clearCheckoutKey();
  return res.json();
}
export async function trackOrder(orderId) {
  const res = await authFetch(`${API}/track-order/${orderId}`);

  if (!res.ok) {
    throw new Error("Failed to fetch order");
  }

  return res.json();
}

/** Live, authoritative wallet balance -- the cached login-time value
 * (AsyncStorage("user").wallet_balance) goes stale after any order, so
 * checkout/wallet screens should call this rather than trust the cache. */
export async function getWalletBalance() {
  const res = await authFetch(`${API}/wallet/balance`);
  if (!res.ok) throw new Error("Failed to fetch wallet balance");
  const data = await res.json();
  return data.wallet_balance;
}

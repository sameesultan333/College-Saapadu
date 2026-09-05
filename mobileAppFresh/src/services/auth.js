import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_URL } from "./config";

const API = API_URL;


const api = axios.create({
  baseURL: API,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

/* ---------------- COLLEGES ---------------- */
export async function getColleges() {
  try {
    const res = await api.get("/colleges");
    return res.data;
  } catch (err) {
    console.log("GET COLLEGES ERROR:", err.response?.data || err.message);
    throw new Error("Unable to load colleges");
  }
}

/* ---------------- LOGIN ---------------- */
// No college_id: phone is globally unique across the platform now, so it
// alone identifies the account (college is only ever picked at
// registration -- see backend models.py User.phone / schemas.py LoginRequest).
export async function loginUser(phone, password) {
  try {

    console.log("LOGIN REQUEST:", phone);

    const res = await api.post("/users/login", {
      phone,
      password
    });

    // Backend now issues an access/refresh token pair alongside the
    // profile fields (same JWT scheme as staff/company_admin -- see
    // backend/auth.py). Every previously-anonymous customer endpoint
    // (order placement, tracking, history, wallet) now requires it.
    const userData = res.data;

    await AsyncStorage.setItem("user", JSON.stringify(userData));

    return userData;

  } catch (err) {

    console.log("LOGIN ERROR:", err.response?.data || err.message);

    if (err.response?.status === 404)
      throw new Error("Invalid Phone Number");

    if (err.response?.status === 401)
      throw new Error("Invalid Password");

    if (err.response?.status === 403)
      throw new Error(err.response?.data?.detail || "Your college is currently inactive.");

    if (err.code === "ECONNABORTED")
      throw new Error("Backend timeout. Check if the server is reachable.");

    if (!err.response)
      throw new Error("Cannot reach backend server.");

    throw new Error("Login failed");
  }
}

/* ---------------- GET USER ---------------- */
export async function getUser() {
  const user = await AsyncStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

/* ---------------- LOGOUT ---------------- */
export async function logout() {
  try {
    const user = await getUser();
    if (user?.refresh_token) {
      // Best-effort -- an unreachable server must never block logout.
      await api.post("/users/logout", { refresh_token: user.refresh_token }).catch(() => {});
    }
  } finally {
    await AsyncStorage.removeItem("user");
  }
}

/* ---------------- AUTHENTICATED REQUESTS ---------------- */
// Every customer-facing backend endpoint now requires the bearer token
// issued at login. This wrapper attaches it and, on a 401, tries
// POST /users/refresh exactly once before giving up -- mirroring
// admin-dashboard's services/apiClient.ts, which uses the same pattern
// for staff/manager sessions.

let refreshPromise = null;

async function refreshAccessToken() {
  const user = await getUser();
  if (!user?.refresh_token) return null;

  try {
    const res = await api.post("/users/refresh", { refresh_token: user.refresh_token });
    const updated = { ...user, ...res.data };
    await AsyncStorage.setItem("user", JSON.stringify(updated));
    return updated.access_token;
  } catch {
    // The refresh token itself is invalid/expired/revoked -- nothing to
    // recover here. Screens will keep getting 401s until the customer
    // logs in again.
    return null;
  }
}

function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * fetch() wrapper for customer-facing endpoints: attaches the bearer
 * token when a session exists, retries once via refresh on a 401.
 * Returns the raw Response, same shape as a plain fetch() call.
 */
export async function authFetch(url, options = {}, _retry = true) {
  const user = await getUser();

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && _retry && user?.refresh_token) {
    const newToken = await refreshOnce();
    if (newToken) {
      return authFetch(url, options, false);
    }
  }

  return res;
}

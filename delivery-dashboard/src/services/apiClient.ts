// Shared request helper for every authenticated call the delivery-dashboard
// makes. Attaches the bearer access_token, and on a 401 tries
// POST /staff/refresh exactly once before retrying — if that also fails the
// session is cleared and an "auth:session-expired" event is dispatched so
// App.js can drop back to the login screen. Mirrors
// admin-dashboard/src/services/apiClient.ts (see CLAUDE.md section 33/34 —
// the frontend never decides authorization, it just carries the token; the
// backend enforces tenant/role scope on every request).
import { API } from "../config/api";
import { AuthSession, getSession, setSession, clearSession } from "../auth/session";

export const SESSION_EXPIRED_EVENT = "auth:session-expired";

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const session = getSession();
  if (!session?.refresh_token) return null;

  try {
    const res = await fetch(`${API}/staff/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!res.ok) return null;

    const tokens = (await res.json()) as Partial<AuthSession>;
    const updated: AuthSession = { ...session, ...tokens } as AuthSession;
    setSession(updated);
    return updated.access_token;
  } catch {
    return null;
  }
}

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function forceLogout(): void {
  clearSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

/**
 * fetch() wrapper that: prefixes the API base URL, attaches the bearer
 * token when a session exists, and retries once via refresh on a 401.
 * Returns the raw Response (mirrors fetch).
 */
export async function apiFetch(path: string, options: RequestInit = {}, _retry = true): Promise<Response> {
  const session = getSession();

  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (res.status === 401 && _retry && session?.refresh_token) {
    const newToken = await refreshOnce();
    if (newToken) {
      return apiFetch(path, options, false);
    }
    forceLogout();
  }

  return res;
}

async function parseJson(res: Response): Promise<any> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

export async function apiGet(path: string): Promise<any> {
  return parseJson(await apiFetch(path, { method: "GET" }));
}

export async function apiPost(path: string, body?: unknown): Promise<any> {
  return parseJson(await apiFetch(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }));
}

export async function apiPut(path: string, body?: unknown): Promise<any> {
  return parseJson(await apiFetch(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }));
}

/** Best-effort server-side logout — never blocks the UI on failure. */
export async function logoutRequest(): Promise<void> {
  const session = getSession();
  if (!session?.refresh_token) return;
  try {
    await apiFetch("/staff/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
  } catch {
    // best-effort only
  }
}

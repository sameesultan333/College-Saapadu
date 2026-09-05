export const API_BASE = import.meta.env.VITE_API_BASE;

const SESSION_KEY = "company_admin";

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

async function refreshAccessToken() {
  const session = getSession();
  if (!session?.refresh_token) return null;

  const res = await fetch(`${API_BASE}/company/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  if (!res.ok) {
    clearSession();
    return null;
  }

  const tokens = await res.json();
  setSession({ ...session, ...tokens });
  return tokens.access_token;
}

async function request(path, options = {}, { retry = true } = {}) {
  const session = getSession();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && retry && session?.refresh_token) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return request(path, options, { retry: false });
    }
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = data?.detail || "Request failed";
    throw new Error(detail);
  }

  return data;
}

export function get(path) {
  return request(path, { method: "GET" });
}

export function post(path, body) {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

export function patch(path, body) {
  return request(path, body !== undefined ? { method: "PATCH", body: JSON.stringify(body) } : { method: "PATCH" });
}

export function del(path) {
  return request(path, { method: "DELETE" });
}

export { getSession, setSession, clearSession };

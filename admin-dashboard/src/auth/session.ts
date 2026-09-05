// Session storage for the admin-dashboard's staff/manager auth.
// Replaces the old hardcoded ADMIN_ACCOUNTS map (see former src/auth/adminAuth.js
// and the per-canteen-code login in the former Login.jsx) with the real
// database-backed session returned by POST /staff/login.
//
// Kept under the same localStorage key ("admin") the app already used, just
// with a new shape — see backend contract: POST /staff/login response.

export type Role = "manager" | "staff";

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: Role;
  college_id: number;
  canteen_id: number | null;
  name: string;
}

const SESSION_KEY = "admin";

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function updateSession(partial: Partial<AuthSession>): void {
  const current = getSession();
  if (!current) return;
  setSession({ ...current, ...partial });
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

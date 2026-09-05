// Session storage for the delivery-dashboard's staff/manager auth.
// Replaces the old hardcoded DELIVERY_ACCOUNTS map (see former
// legacy per-canteen-code login) with the real
// database-backed session returned by POST /staff/login.
//
// Mirrors admin-dashboard/src/auth/session.ts. Delivery accounts always
// carry role "delivery" and a fixed canteen_id — the login screen rejects
// any other role rather than storing a session for it.

export type Role = "manager" | "staff" | "delivery";

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: Role;
  college_id: number;
  canteen_id: number | null;
  canteen_name?: string;
  name: string;
}

const SESSION_KEY = "delivery";

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

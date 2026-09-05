import { post, getSession, setSession, clearSession } from "../../services/api";

// identifier: an email address or a phone number
export async function loginCompanyAdmin(identifier, password) {
  const isEmail = identifier.includes("@");
  const payload = isEmail
    ? { email: identifier, password }
    : { phone: identifier, password };

  const tokens = await post("/company/login", payload);
  setSession(tokens);
  return tokens;
}

export function getCompanyAdmin() {
  return getSession();
}

export async function logoutCompanyAdmin() {
  const session = getSession();
  if (session?.refresh_token) {
    try {
      await post("/company/logout", { refresh_token: session.refresh_token });
    } catch {
      // best-effort revoke; clear local session regardless
    }
  }
  clearSession();
}

import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

import { loginCompanyAdmin } from "./companyAuth";
import { Spin } from "../../components/ledgerKit";
import {
  INK_3,
  field,
  primaryCta,
  DANGER,
  GROUP,
  LABEL,
  PASSWORD_WRAP,
  EYE,
  FOREST,
  AUTH_PAGE,
  AUTH_CARD,
  AUTH_WORDMARK,
  AUTH_CONTEXT,
  AUTH_RULE,
  AUTH_FORM,
} from "../../theme/ledger";

interface Admin {
  name?: string;
  [key: string]: unknown;
}

interface LoginPageProps {
  onLoggedIn: (admin: Admin) => void;
}

/**
 * Company Admin sign-in. Rebuilt in the same ledger style as the console
 * pages (Layout/ManagersPage/CollegePage) — the plain white-card/indigo
 * look in the old LoginPage.css was the last screen not on this system.
 */
export default function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!identifier || !password) {
      setError("Enter email/phone and password");
      return;
    }

    setLoading(true);
    try {
      const admin = await loginCompanyAdmin(identifier, password);
      onLoggedIn(admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={AUTH_PAGE}>
      <form style={AUTH_CARD} onSubmit={handleSubmit} autoComplete="off">
        <p style={AUTH_WORDMARK}>College Saapadu</p>
        <p style={AUTH_CONTEXT}>Company Console</p>
        <hr style={AUTH_RULE} />

        <div style={AUTH_FORM}>
          <div style={GROUP}>
            <label htmlFor="login-id" style={LABEL}>Email or phone</label>
            <input
              id="login-id"
              style={field(focusedField === "id", true)}
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@collegesaapadu.com"
              autoComplete="username"
              onFocus={() => setFocusedField("id")}
              onBlur={() => setFocusedField(null)}
              autoFocus
            />
          </div>

          <div style={GROUP}>
            <label htmlFor="login-password" style={LABEL}>Password</label>
            <div style={PASSWORD_WRAP}>
              <input
                id="login-password"
                style={{ ...field(focusedField === "password", true), paddingRight: "2.4rem" }}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                style={{ ...EYE, color: showPassword || focusedField === "password" ? FOREST : INK_3 }}
                onFocus={() => setFocusedField("eye")}
                onBlur={() => setFocusedField(null)}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={15} strokeWidth={2} aria-hidden="true" /> : <Eye size={15} strokeWidth={2} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <p style={DANGER} role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={primaryCta(hover === "submit", loading)}
            onMouseEnter={() => setHover("submit")}
            onMouseLeave={() => setHover((h) => (h === "submit" ? null : h))}
          >
            {loading ? (
              <Spin>
                <Loader2 size={15} strokeWidth={2.5} aria-hidden="true" />
              </Spin>
            ) : (
              "Sign in"
            )}
            <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

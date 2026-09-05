import { useState } from "react";
import { loginCompanyAdmin } from "./companyAuth";
import "./LoginPage.css";

export default function LoginPage({ onLoggedIn }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
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
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>College Saapadu</h1>
        <p className="subtitle">Company Portal</p>

        {error && <div className="login-error">{error}</div>}

        <label>
          Email or Phone
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="admin@collegesaapadu.com or phone number"
            autoComplete="username"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

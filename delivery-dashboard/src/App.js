import { useCallback, useEffect, useState } from "react";
import DeliveryLogin from "./pages/DeliveryLogin";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import { getSession, clearSession } from "./auth/session";
import { logoutRequest, SESSION_EXPIRED_EVENT } from "./services/apiClient";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  /* 🔐 CHECK LOGIN ON LOAD */
  useEffect(() => {
    if (getSession()) setLoggedIn(true);
  }, []);

  /* 🔐 FORCED LOGOUT (refresh token expired/invalid — see apiClient) */
  useEffect(() => {
    const handleExpired = () => setLoggedIn(false);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  /* ✅ LOGIN */
  const handleLogin = () => {
    setLoggedIn(true);
  };

  /* 🚪 LOGOUT */
  const handleLogout = useCallback(async () => {
    await logoutRequest(); // best-effort, never blocks the UI
    clearSession();
    setLoggedIn(false);
  }, []);

  /* 🔀 ROUTING */
  if (!loggedIn) {
    return <DeliveryLogin onLogin={handleLogin} />;
  }

  return <DeliveryDashboard onLogout={handleLogout} />;
}

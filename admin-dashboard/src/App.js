import { useEffect, useState } from "react";
import Login from "./pages/Login";
import ManagerDashboard from "./pages/ManagerDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import { getSession, clearSession } from "./auth/session";
import { SESSION_EXPIRED_EVENT, logoutRequest } from "./services/apiClient";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  const [session, setSessionState] = useState(() => getSession());
  const [loginNotice, setLoginNotice] = useState("");

  /* ============ FORCED LOGOUT ON REFRESH FAILURE ============ */
  useEffect(() => {
    const handleExpired = () => {
      setLoginNotice("Your session expired. Please log in again.");
      setSessionState(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  /* ================= LOGIN ================= */
  const handleLogin = () => {
    // Login.tsx already stored the session via setSession()
    setLoginNotice("");
    setSessionState(getSession());
  };

  /* ================= LOGOUT ================= */
  const handleLogout = () => {
    logoutRequest(); // best-effort, doesn't block the UI
    clearSession();
    setLoginNotice("");
    setSessionState(null);
  };

  /* ================= ROUTING ================= */
  if (!session) {
    return <Login onLogin={handleLogin} notice={loginNotice} />;
  }

  return (
    <ErrorBoundary onReset={handleLogout}>
      {session.role === "manager" ? (
        <ManagerDashboard onLogout={handleLogout} />
      ) : (
        <StaffDashboard onLogout={handleLogout} />
      )}
    </ErrorBoundary>
  );
}

export default App;

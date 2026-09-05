import { Navigate, Outlet } from "react-router-dom";
import { getUser } from "../services/auth";

export default function ProtectedRoute() {
  const user = getUser();

  if (!user) {
    return user ? <Outlet /> : <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

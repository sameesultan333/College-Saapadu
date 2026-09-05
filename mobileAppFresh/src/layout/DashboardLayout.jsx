import { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "../components/Sidebar";
import { WS_URL } from "../services/config";
import "../styles/DashboardLayout.css";

const WS_BASE = WS_URL;

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/canteen/1`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "STATUS_UPDATE" && data.status === "READY") {
        setNotification("🎉 Your order is ready for pickup!");
        setTimeout(() => setNotification(null), 5000);
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  return (
    <div className="layout-root">
      <Header
        onProfileClick={() => setSidebarOpen(!sidebarOpen)}
        notification={notification}
      />

      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}

      <main className="layout-main">
        <div className="layout-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

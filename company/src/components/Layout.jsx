import { logoutCompanyAdmin } from "../modules/login/companyAuth";
import "./Layout.css";

export default function Layout({ admin, activeTab, onTabChange, onLogout, children }) {
  async function handleLogout() {
    await logoutCompanyAdmin();
    onLogout();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">College Saapadu · Company Portal</div>
        <nav className="app-nav">
          <button
            className={activeTab === "colleges" ? "active" : ""}
            onClick={() => onTabChange("colleges")}
          >
            Colleges
          </button>
          <button
            className={activeTab === "managers" ? "active" : ""}
            onClick={() => onTabChange("managers")}
          >
            Managers
          </button>
        </nav>
        <div className="app-header-right">
          <span className="admin-email">{admin?.name}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

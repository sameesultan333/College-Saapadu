import type { ReactNode } from "react";
import { useState } from "react";
import { logoutCompanyAdmin } from "../modules/login/companyAuth";
import {
  PAGE,
  FRAME,
  MAST,
  WORDMARK,
  MAST_CONTEXT,
  MAST_NAV,
  MAST_RIGHT,
  MAST_ADMIN,
  mastLink,
  textAction,
} from "../theme/ledger";

type Tab = "colleges" | "managers";

interface LayoutProps {
  admin: { name?: string } | null;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * The single top-level shell for the whole console: one masthead (brand,
 * section nav, admin identity + logout), rendered once. Pages below no
 * longer carry their own copy of this — see ManagersPage.tsx/CollegePage.tsx,
 * which used to each render a second, competing masthead of their own.
 */
export default function Layout({ admin, activeTab, onTabChange, onLogout, children }: LayoutProps) {
  const [hover, setHover] = useState<string | null>(null);
  const hoverProps = (key: string) => ({
    onMouseEnter: () => setHover(key),
    onMouseLeave: () => setHover((h) => (h === key ? null : h)),
  });

  async function handleLogout() {
    await logoutCompanyAdmin();
    onLogout();
  }

  return (
    <div style={PAGE}>
      <div style={FRAME}>
        <header style={MAST}>
          <div>
            <p style={WORDMARK}>College Saapaadu</p>
            <p style={MAST_CONTEXT}>Company Console</p>
          </div>

          <nav style={MAST_NAV} aria-label="Console">
            <button
              type="button"
              style={mastLink(activeTab === "managers", hover === "nav-m")}
              {...hoverProps("nav-m")}
              aria-current={activeTab === "managers" ? "page" : undefined}
              onClick={() => onTabChange("managers")}
            >
              Managers
            </button>
            <button
              type="button"
              style={mastLink(activeTab === "colleges", hover === "nav-c")}
              {...hoverProps("nav-c")}
              aria-current={activeTab === "colleges" ? "page" : undefined}
              onClick={() => onTabChange("colleges")}
            >
              Colleges
            </button>
          </nav>

          <div style={MAST_RIGHT}>
            {admin?.name && <span style={MAST_ADMIN}>{admin.name}</span>}
            <button
              type="button"
              style={textAction("neutral", hover === "logout")}
              {...hoverProps("logout")}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

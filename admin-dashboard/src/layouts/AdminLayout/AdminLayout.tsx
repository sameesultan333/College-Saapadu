import { CSSProperties, ComponentType, ReactNode } from "react";
import theme from "../../theme/theme";
import Header from "../Header/Header";
import TabNav from "../TabNav/TabNav";

interface TabItem {
  id: string;
  icon?: string | ComponentType<{ size?: number }>;
  label: string;
  badge?: number;
}

interface AdminLayoutProps {
  canteenName?: string;
  staffName?: string;
  onLogout: () => void;
  onBack?: (() => void) | null;
  tabs: TabItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  notifications?: ReactNode;
  children?: ReactNode;
}

const styles = {
  shell: {
    fontFamily: theme.dashboard.typography.fontFamily,
    background: `linear-gradient(135deg, ${theme.dashboard.color.bgGradientStart} 0%, ${theme.dashboard.color.bgGradientEnd} 100%)`,
    minHeight: "100vh",
    color: theme.dashboard.color.text,
  } as CSSProperties,
  content: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "2rem",
  } as CSSProperties,
};

export default function AdminLayout({
  canteenName,
  staffName,
  onLogout,
  onBack = null,
  tabs,
  activeTab,
  onSelectTab,
  notifications = null,
  children,
}: AdminLayoutProps) {
  return (
    <div className="dashboard-shell" style={styles.shell}>
      <Header canteenName={canteenName} staffName={staffName} onLogout={onLogout} onBack={onBack} />
      <TabNav tabs={tabs} activeTab={activeTab} onSelect={onSelectTab} />

      {notifications}

      <main className="dashboard-content" style={styles.content}>{children}</main>
    </div>
  );
}

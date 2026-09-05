import { CSSProperties, ComponentType } from "react";
import theme from "../../theme/theme";

interface TabItem {
  id: string;
  icon?: string | ComponentType<{ size?: number }>;
  label: string;
  badge?: number;
}

interface TabNavProps {
  tabs: TabItem[];
  activeTab: string;
  onSelect: (id: string) => void;
}

const styles = {
  nav: {
    background: theme.dashboard.color.white,
    borderBottom: `2px solid ${theme.dashboard.color.border}`,
    padding: "0 2rem",
    display: "flex",
    gap: "0.5rem",
    maxWidth: 1400,
    margin: "0 auto",
    overflowX: "auto",
  } as CSSProperties,
  button: (isActive: boolean): CSSProperties => ({
    background: theme.dashboard.color.transparent,
    border: "none",
    borderBottom: isActive ? `3px solid ${theme.dashboard.color.primary}` : `3px solid ${theme.dashboard.color.transparent}`,
    padding: "1rem 1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: 500,
    color: isActive ? theme.dashboard.color.primary : theme.dashboard.color.textMuted,
    transition: "all 0.2s ease",
    position: "relative",
    whiteSpace: "nowrap",
  }),
  badge: {
    background: theme.dashboard.color.primary,
    color: theme.dashboard.color.white,
    fontSize: "0.75rem",
    padding: "0.15rem 0.5rem",
    borderRadius: theme.dashboard.borderRadius.lg,
    fontWeight: 600,
    minWidth: 20,
    textAlign: "center",
  } as CSSProperties,
};

export default function TabNav({ tabs, activeTab, onSelect }: TabNavProps) {
  return (
    <nav className="dashboard-tab-nav" style={styles.nav} aria-label="Dashboard sections">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`dashboard-tab ${isActive ? "is-active" : ""}`}
            style={styles.button(isActive)}
            onClick={() => onSelect(tab.id)}
          >
            {typeof tab.icon === "string" ? (
              <span style={{ fontSize: "1.2rem" }}>{tab.icon}</span>
            ) : (
              tab.icon && <tab.icon size={18} />
            )}
            <span>{tab.label}</span>
            {Number(tab.badge ?? 0) > 0 && <span style={styles.badge}>{tab.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}

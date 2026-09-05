import { CSSProperties } from "react";
import theme from "../../theme/theme";

interface SuccessToastProps { message: string }
const styles = { wrapper: { position: "fixed", top: 100, right: "2rem", zIndex: 1001 } as CSSProperties, content: { background: `linear-gradient(135deg, ${theme.dashboard.color.success}, ${theme.dashboard.color.successLight})`, color: theme.dashboard.color.white, padding: "1rem 1.5rem", borderRadius: 12, boxShadow: theme.dashboard.color.successToastShadow, display: "flex", alignItems: "center", gap: "0.75rem", fontWeight: 600 } as CSSProperties };

// Extracted verbatim from the inline `showOrderSuccess` block in
// AdminDashboard.jsx.
export default function SuccessToast({ message }: SuccessToastProps) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.content}>
        <span style={{ fontSize: "1.5rem" }}>✅</span>
        <span>{message}</span>
      </div>
    </div>
  );
}

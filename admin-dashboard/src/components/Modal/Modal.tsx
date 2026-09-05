import { CSSProperties, MouseEvent, ReactNode } from "react";
import theme from "../../theme/theme";

export const modalStyles = {
  body: { padding: "2rem" } as CSSProperties,
  footer: { padding: "1.5rem 2rem", borderTop: `1px solid ${theme.dashboard.color.border}`, display: "flex", justifyContent: "flex-end", gap: "1rem" } as CSSProperties,
  secondaryButton: { background: theme.dashboard.color.neutralBg, color: theme.dashboard.color.textLabel, border: `1px solid ${theme.dashboard.color.border}`, borderRadius: theme.dashboard.borderRadius.md, padding: "0.75rem 1.25rem", fontWeight: 600, cursor: "pointer" } as CSSProperties,
  primaryButton: { background: theme.dashboard.color.primary, color: theme.dashboard.color.white, border: "none", borderRadius: theme.dashboard.borderRadius.md, padding: "0.75rem 1.25rem", fontWeight: 600, cursor: "pointer" } as CSSProperties,
};

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  contentClassName?: string;
}

// Generic reusable modal chrome (overlay + card + header).
// `children` renders the rest of the modal (body/footer, or a <form>
// wrapping body+footer for the Add Menu Item modal) so each consumer keeps
// exactly the original markup shape it had inline in AdminDashboard.jsx.
export default function Modal({ title, onClose, children, contentClassName = "" }: ModalProps) {
  return (
    <div style={{ position: "fixed", inset: 0, background: theme.dashboard.color.black50, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)", padding: "1rem" }} onClick={onClose}>
      <div
        style={{ background: theme.dashboard.color.white, borderRadius: 20, width: "90%", maxWidth: contentClassName === "payment-modal" ? 600 : 600, maxHeight: "90vh", overflowY: "auto", boxShadow: theme.dashboard.shadow.modal }}
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.75rem 2rem", borderBottom: `1px solid ${theme.dashboard.color.border}` }}>
          <h2 style={{ fontSize: "1.5rem", color: theme.dashboard.color.text, margin: 0 }}>{title}</h2>
          <button type="button" style={{ width: 36, height: 36, border: "none", background: theme.dashboard.color.dangerBg, color: theme.dashboard.color.danger, borderRadius: theme.dashboard.borderRadius.round, fontSize: "1.5rem", cursor: "pointer" }} onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

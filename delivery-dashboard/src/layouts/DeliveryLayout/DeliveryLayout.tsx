import Header from "../Header/Header";
import type { CSSProperties, ReactNode } from "react";

interface DeliveryLayoutProps {
  canteenName: string;
  courierName?: string;
  onLogout: () => void;
  children: ReactNode;
}

/* Page atmosphere — the same two-tint ambient wash as the admin app's
   body: amber (action) top-right, herb (brand) top-left, over the warm
   page token. Two acknowledged literals (the accent rgbas) — inline
   styles can't apply alpha to a var(); keep in sync with #d98e3b /
   #1e3b2b. The 135° cream→white gradient this replaces did nothing the
   tokens don't do better. */
const containerStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(1100px 560px at 88% -8%, rgba(217, 142, 59, 0.05), transparent 60%), " +
    "radial-gradient(1000px 540px at -10% -6%, rgba(30, 59, 43, 0.04), transparent 58%), " +
    "var(--bc-color-surface-page, #f8f1e4)",
  fontFamily: "var(--bc-font-family, inherit)",
  color: "var(--bc-color-text-primary, #2b231c)",
};

// The header is sticky but sits in normal flow, so it can't literally
// overlap what follows -- the "overlapping" look was the content (tab
// switcher, order grid) starting with zero top/side margin, flush
// against the header's bottom edge and the viewport edges. Centralizing
// page padding here, once, instead of in every feature module, is what
// keeps every screen breathing the same amount instead of drifting.
const mainStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "var(--bc-space-24, 1.5rem) var(--bc-space-page-padding, clamp(1.25rem, 3vw, 2.75rem)) var(--bc-space-40, 2.5rem)",
  display: "grid",
  gap: "var(--bc-space-20, 1.25rem)",
};

/**
 * Page-level chrome for the Delivery Dashboard: the sticky header plus
 * the padded, centered content area. Feature modules are rendered as
 * children; fixed-position overlays (modals, scanner, toasts) ignore
 * this padding entirely since they're out of normal flow.
 */
export default function DeliveryLayout({ canteenName, courierName, onLogout, children }: DeliveryLayoutProps) {
  return (
    <div style={containerStyle}>
      <Header canteenName={canteenName} courierName={courierName} onLogout={onLogout} />
      <main id="main-content" style={mainStyle}>
        {children}
      </main>
    </div>
  );
}
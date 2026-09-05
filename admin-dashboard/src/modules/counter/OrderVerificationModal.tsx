import { CSSProperties } from "react";
import QRCode from "react-qr-code";
import Modal, { modalStyles } from "../../components/Modal/Modal";
import theme from "../../theme/theme";

interface OrderVerificationModalProps {
  orderId: number;
  guestCode: string | null;
  verificationToken: string;
  onClose: () => void;
}

const styles = {
  body: { padding: "2rem", textAlign: "center", display: "grid", gap: "1rem", justifyItems: "center" } as CSSProperties,
  qrWrap: { background: theme.dashboard.color.white, padding: "1rem", borderRadius: theme.dashboard.borderRadius.lg },
  orderId: { fontSize: "1.1rem", fontWeight: 700, color: theme.dashboard.color.text, margin: 0 },
  guestCode: { color: theme.dashboard.color.primary, fontWeight: 700, fontSize: "1.4rem", margin: 0 },
  hint: { color: theme.dashboard.color.textMuted, fontSize: "0.85rem", margin: 0, maxWidth: 320 },
};

// Shown right after a walk-in order is placed. SMS/WhatsApp delivery of
// this isn't wired up yet (future work) -- until then, this screen is the
// only way the customer sees their pickup QR, so staff show/let them
// photograph it here. The QR encodes ONLY the verification token, never
// order contents or customer details -- delivery staff must call
// POST /verification/{token}/verify rather than trusting anything
// decoded from it client-side.
export default function OrderVerificationModal({ orderId, guestCode, verificationToken, onClose }: OrderVerificationModalProps) {
  return (
    <Modal title="Order Confirmed" onClose={onClose}>
      <div style={styles.body}>
        <p style={styles.orderId}>Order #{orderId}</p>
        {guestCode && <p style={styles.guestCode}>{guestCode}</p>}
        <div style={styles.qrWrap}>
          <QRCode value={verificationToken} size={180} />
        </div>
        <p style={styles.hint}>
          Show this QR at pickup. SMS delivery isn't set up yet, so please let the customer
          photograph it or note their {guestCode ? "guest code" : "order number"} above.
        </p>
      </div>
      <div style={modalStyles.footer}>
        <button type="button" style={modalStyles.primaryButton} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

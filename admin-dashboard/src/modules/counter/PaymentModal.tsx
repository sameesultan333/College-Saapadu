import Modal from "../../components/Modal/Modal";
import { CSSProperties, ChangeEvent } from "react";
import theme from "../../theme/theme";

type PaymentMethod = "CASH" | "UPI" | "WALLET";
interface CartItem { id: number; name: string; price: number; quantity: number }
interface PaymentModalProps {
  cart: CartItem[];
  paymentMethod: PaymentMethod;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  cashReceived: string;
  onCashReceivedChange: (value: string) => void;
  getCartTotal: () => number;
  getChange: () => number;
  formatCurrency: (value: number) => string;
  onClose: () => void;
  onConfirm: () => void;
  // Walk-in/guest customers have no app wallet -- the backend rejects
  // WALLET for guest orders, so this hides that dead-end option rather
  // than letting staff pick it and hit an error.
  showWallet?: boolean;
}

const styles = {
  body: { padding: "2rem" } as CSSProperties,
  panel: { background: theme.dashboard.color.bgGradientStart, borderRadius: theme.dashboard.borderRadius.lg, padding: "1.5rem", marginBottom: "1.5rem" } as CSSProperties,
  heading: { fontSize: "1.2rem", color: theme.dashboard.color.text, margin: "0 0 1rem" },
  row: { display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: `1px dashed ${theme.dashboard.color.border}` } as CSSProperties,
  total: { display: "flex", justifyContent: "space-between", padding: "1rem", background: theme.dashboard.color.white, borderRadius: theme.dashboard.borderRadius.md, fontWeight: 700, fontSize: "1.1rem" } as CSSProperties,
  methods: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" } as CSSProperties,
  method: (active: boolean): CSSProperties => ({ background: active ? `linear-gradient(135deg, ${theme.dashboard.color.warningBg}, ${theme.dashboard.color.warningBg2})` : theme.dashboard.color.white, border: `2px solid ${active ? theme.dashboard.color.primary : theme.dashboard.color.border}`, padding: "1.25rem", borderRadius: theme.dashboard.borderRadius.lg, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", fontWeight: 600, color: active ? theme.dashboard.color.primary : theme.dashboard.color.textMuted }),
  calculator: { background: theme.dashboard.color.neutralBg, borderRadius: theme.dashboard.borderRadius.lg, padding: "1.5rem" } as CSSProperties,
  input: { width: "100%", boxSizing: "border-box", padding: "1rem", border: `2px solid ${theme.dashboard.color.neutralBorder2}`, borderRadius: theme.dashboard.borderRadius.md, fontSize: "1.1rem", fontWeight: 600 } as CSSProperties,
  changes: { background: theme.dashboard.color.white, borderRadius: theme.dashboard.borderRadius.md, padding: "1.25rem", marginTop: "1rem" } as CSSProperties,
  changeRow: { display: "flex", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: `1px dashed ${theme.dashboard.color.border}` } as CSSProperties,
  highlight: { background: `linear-gradient(135deg, ${theme.dashboard.color.successBg}, ${theme.dashboard.color.successBorder})`, padding: "1rem", borderRadius: theme.dashboard.borderRadius.sm, marginTop: "0.5rem" } as CSSProperties,
  alert: { background: theme.dashboard.color.dangerBg, color: theme.dashboard.color.dangerDark, padding: "0.75rem 1rem", borderRadius: theme.dashboard.borderRadius.sm, fontSize: "0.9rem", fontWeight: 500, marginTop: "1rem" } as CSSProperties,
  footer: { padding: "1.5rem 2rem", borderTop: `1px solid ${theme.dashboard.color.border}`, display: "flex", justifyContent: "flex-end", gap: "1rem" } as CSSProperties,
  secondary: { background: theme.dashboard.color.neutralBg, color: theme.dashboard.color.textLabel, border: `1px solid ${theme.dashboard.color.border}`, borderRadius: theme.dashboard.borderRadius.md, padding: "0.75rem 1.25rem", fontWeight: 600, cursor: "pointer" } as CSSProperties,
  primary: { background: theme.dashboard.color.primary, color: theme.dashboard.color.white, border: "none", borderRadius: theme.dashboard.borderRadius.md, padding: "0.75rem 1.25rem", fontWeight: 600, cursor: "pointer" } as CSSProperties,
};

// Extracted verbatim from the showPaymentModal block in AdminDashboard.jsx.
export default function PaymentModal({
  cart,
  paymentMethod,
  onSelectPaymentMethod,
  cashReceived,
  onCashReceivedChange,
  getCartTotal,
  getChange,
  formatCurrency,
  onClose,
  onConfirm,
  showWallet = true,
}: PaymentModalProps) {
  return (
    <Modal title="Payment Method" onClose={onClose} contentClassName="payment-modal">
      <div style={styles.body}>
        <div style={styles.panel}>
          <h3 style={styles.heading}>Order Summary</h3>
          <div>
            {cart.map((item) => (
              <div key={item.id} style={styles.row}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div style={styles.total}>
            <span>Total Amount</span>
            <span className="total-value">{formatCurrency(getCartTotal())}</span>
          </div>
        </div>

        <div style={{ ...styles.panel, background: theme.dashboard.color.transparent, padding: 0 }}>
          <h3 style={styles.heading}>Select Payment Method</h3>
          <div style={styles.methods}>
            <button
              type="button"
              style={styles.method(paymentMethod === "CASH")}
              onClick={() => onSelectPaymentMethod("CASH")}
            >
              <span className="payment-icon">💵</span>
              <span>Cash</span>
            </button>
            <button
              type="button"
              style={styles.method(paymentMethod === "UPI")}
              onClick={() => onSelectPaymentMethod("UPI")}
            >
              <span className="payment-icon">📱</span>
              <span>UPI</span>
            </button>
            {showWallet && (
              <button
                type="button"
                style={styles.method(paymentMethod === "WALLET")}
                onClick={() => onSelectPaymentMethod("WALLET")}
              >
                <span className="payment-icon">💳</span>
                <span>Wallet</span>
              </button>
            )}
          </div>
        </div>

        {paymentMethod === "CASH" && (
          <div style={styles.calculator}>
            <h3 style={styles.heading}>Cash Calculation</h3>
            <div style={{ marginBottom: "1rem" }}>
              <label>Cash Received</label>
              <input
                type="number"
                placeholder="Enter amount"
                value={cashReceived}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onCashReceivedChange(e.target.value)}
                style={styles.input}
              />
            </div>
            {cashReceived && parseFloat(cashReceived) >= getCartTotal() && (
              <div style={styles.changes}>
                <div style={styles.changeRow}>
                  <span>Amount Received:</span>
                  <span className="amount-value">{formatCurrency(parseFloat(cashReceived))}</span>
                </div>
                <div style={styles.changeRow}>
                  <span>Order Total:</span>
                  <span className="amount-value">{formatCurrency(getCartTotal())}</span>
                </div>
                <div style={{ ...styles.changeRow, ...styles.highlight }}>
                  <span>Change to Return:</span>
                  <span className="change-value">{formatCurrency(getChange())}</span>
                </div>
              </div>
            )}
            {cashReceived && parseFloat(cashReceived) < getCartTotal() && (
              <div style={styles.alert}>
                ⚠️ Insufficient amount. Need {formatCurrency(getCartTotal() - parseFloat(cashReceived))} more
              </div>
            )}
          </div>
        )}
      </div>
      <div style={styles.footer}>
        <button type="button" style={styles.secondary} onClick={onClose}>
          Cancel
        </button>
        <button type="button" style={styles.primary} onClick={onConfirm}>
          Confirm Order
        </button>
      </div>
    </Modal>
  );
}

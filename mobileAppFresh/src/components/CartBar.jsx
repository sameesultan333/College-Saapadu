import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function CartBar() {
  const { cart, totalAmount } = useCart();
  const navigate = useNavigate();

  if (cart.length === 0) return null;

  return (
    <div className="cart-bar">
      <span>{cart.length} items</span>
      <strong>₹{totalAmount}</strong>
      <button onClick={() => navigate("/checkout")}>
        Checkout →
      </button>
    </div>
  );
}

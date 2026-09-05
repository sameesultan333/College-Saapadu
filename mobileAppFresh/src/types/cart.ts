/**
 * Cart types shared by MenuPageScreen and CheckoutScreen via CartContext.
 * The cart never reserves inventory -- it is pure local UI state until
 * CheckoutScreen calls placeBatchOrder(). See CLAUDE.md sections 56-57.
 */
export interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
  is_veg?: boolean;
  image_url?: string | null;
  canteenId: number;
  canteenName: string;
}

/** An item as passed into addToCart() -- qty is added by the context, not the caller. */
export type CartItemInput = Omit<CartItem, "qty"> & { qty?: number };

export interface CartGroup {
  canteenId: number;
  canteenName: string;
  items: CartItem[];
}

export interface CartContextValue {
  cart: Record<number, CartGroup>;
  cartGroups: CartGroup[];
  cartItems: CartItem[];
  totalAmount: number;
  totalItemsCount: number;
  addToCart: (item: CartItemInput) => void;
  removeFromCart: (itemId: number, canteenId: number) => void;
  clearCart: () => void;
  getItemQty: (itemId: number, canteenId: number) => number;
}

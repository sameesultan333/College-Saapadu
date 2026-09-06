import React, { createContext, useCallback, useContext, useState, useMemo, ReactNode } from "react";
import type { CartContextValue, CartGroup, CartItemInput } from "../types/cart";

export const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // cart structure: { [canteenId]: { canteenId, canteenName, items: [...] } }
  const [cart, setCart] = useState<Record<number, CartGroup>>({});

  // Every function below is wrapped in useCallback and the provider's
  // context value is memoized (bottom of this function) so that a cart
  // mutation only re-renders the screens that actually read the piece of
  // state that changed, instead of every useCart() consumer in the app
  // re-rendering because the context value was a brand-new object/set of
  // functions on every CartProvider render.
  const addToCart = useCallback((item: CartItemInput) => {
    setCart((prev) => {
      const cid = item.canteenId;

      const canteenCart: CartGroup = prev[cid] || {
        canteenId: cid,
        canteenName: item.canteenName,
        items: [],
      };

      const exists = canteenCart.items.find((i) => i.id === item.id);

      const updatedItems = exists
        ? canteenCart.items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
        : [...canteenCart.items, { ...item, qty: item.qty ?? 1 }];

      return {
        ...prev,
        [cid]: {
          ...canteenCart,
          canteenName: canteenCart.canteenName || item.canteenName,
          items: updatedItems,
        },
      };
    });
  }, []);

  const removeFromCart = useCallback((itemId: number, canteenId: number) => {
    setCart((prev) => {
      const canteenCart = prev[canteenId];
      if (!canteenCart) return prev;

      const item = canteenCart.items.find((i) => i.id === itemId);
      if (!item) return prev;

      const updatedItems =
        item.qty === 1
          ? canteenCart.items.filter((i) => i.id !== itemId)
          : canteenCart.items.map((i) => (i.id === itemId ? { ...i, qty: i.qty - 1 } : i));

      if (updatedItems.length === 0) {
        const { [canteenId]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [canteenId]: { ...canteenCart, items: updatedItems },
      };
    });
  }, []);

  const clearCart = useCallback(() => setCart({}), []);

  const cartGroups = useMemo(() => Object.values(cart), [cart]);

  const cartItems = useMemo(() => cartGroups.flatMap((group) => group.items), [cartGroups]);

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cartItems]
  );

  const totalItemsCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems]
  );

  const getItemQty = useCallback(
    (itemId: number, canteenId: number) =>
      cart[canteenId]?.items.find((i) => i.id === itemId)?.qty || 0,
    [cart]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      cartGroups,
      cartItems,
      totalAmount,
      totalItemsCount,
      addToCart,
      removeFromCart,
      clearCart,
      getItemQty,
    }),
    [cart, cartGroups, cartItems, totalAmount, totalItemsCount, addToCart, removeFromCart, clearCart, getItemQty]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return ctx;
}

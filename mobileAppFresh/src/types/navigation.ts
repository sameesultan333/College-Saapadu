import type { CartGroup } from "./cart";

/**
 * Tabs shown on the bottom tab bar (Home/Orders/Wallet/Profile), matching
 * the approved design reference. Canteen selection lives on Home -- it is
 * NOT its own tab, per the product direction (see CanteenSelectScreen.tsx).
 *
 * Route names here intentionally match the screen names used everywhere
 * else in the app (Sidebar, FoodAssistant, OrderHistoryScreen's own
 * navigate() calls, ...) so existing `navigation.navigate("CanteenSelectScreen")`-
 * style calls keep resolving to the same screens now that they live inside
 * this nested tab navigator, with no renaming required at every call site.
 */
export type MainTabParamList = {
  CanteenSelectScreen: undefined;
  OrderHistoryScreen: undefined;
  TrackOrderScreen: { orderId?: number } | undefined;
  WalletScreen: undefined;
  ProfileScreen: undefined;
};

/**
 * Root stack: MainTabs is the tabbed "home" of the app; everything else
 * here is a screen pushed on top of it (so the tab bar hides while a Menu/
 * Checkout/OrderSuccess/TrackOrder screen is on top, matching the
 * reference's showNav behavior).
 */
export type RootStackParamList = {
  Login: undefined;
  RegisterScreen: undefined;
  MainTabs: undefined;
  MenuPageScreen: { canteenId: number; canteenName: string; canteenIsActive?: boolean };
  CheckoutScreen: undefined;
  OrderSuccessScreen: {
    orders: unknown;
    cartGroups: CartGroup[];
    totalPrice: number;
    paymentMode: string;
  };
};

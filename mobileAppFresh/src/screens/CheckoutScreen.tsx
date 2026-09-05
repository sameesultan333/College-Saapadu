/**
 * CheckoutScreen.tsx
 *
 * Navigation: navigate("CheckoutScreen")
 * On success: navigate("OrderSuccessScreen", { orders, cartGroups, totalPrice, paymentMode })
 *
 * Frontend never calculates authoritative inventory/price/GST and never
 * declares payment success on its own -- placeBatchOrder() is the only
 * source of truth, carrying the durable Idempotency-Key (see services/api.js)
 * so a retry after an unknown-outcome network error is safe. See CLAUDE.md
 * sections 9-11 (mobile idempotency) and 52-101 (checkout/inventory/payment).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Banknote,
  Check,
  ChevronRight,
  ChevronUp,
  Clock,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Trash2,
  Wallet,
} from "lucide-react-native";
import { useCart } from "../context/CartContext";
import { getUser } from "../services/auth";
import { placeBatchOrder, getWalletBalance } from "../services/api";
import AppLayout from "../layout/AppLayout";
import ScreenHeader from "../components/food/ScreenHeader";
import { getFoodColors, foodTypography, foodCardShadow } from "../theme/foodTheme";
import type { RootStackParamList } from "../types/navigation";
import type { CartItem } from "../types/cart";
import type { User } from "../types/user";

type Props = NativeStackScreenProps<RootStackParamList, "CheckoutScreen">;
type PaymentMode = "WALLET" | "UPI" | "CASH";

const C = getFoodColors(false);

// ─── Step indicator ───────────────────────────────────
function StepIndicator() {
  return (
    <View style={S.progress}>
      <View style={S.step}>
        <View style={[S.stepDot, S.stepDotDone]}>
          <Check size={13} color="#FFF" strokeWidth={3} />
        </View>
        <Text style={[S.stepLbl, { color: C.green }]}>Cart</Text>
      </View>
      <View style={[S.stepLine, S.stepLineActive]} />
      <View style={S.step}>
        <View style={[S.stepDot, S.stepDotActive]}>
          <Text style={S.stepNum}>2</Text>
        </View>
        <Text style={[S.stepLbl, { color: C.action }]}>Checkout</Text>
      </View>
      <View style={S.stepLine} />
      <View style={S.step}>
        <View style={S.stepDot}>
          <Text style={S.stepNum}>3</Text>
        </View>
        <Text style={S.stepLbl}>Done</Text>
      </View>
    </View>
  );
}

// ─── Cart item row ────────────────────────────────────
function CartItemRow({
  item, canteenId, onQtyChange, enterAnim,
}: { item: CartItem; canteenId: number; onQtyChange: (canteenId: number, itemId: number, delta: number) => void; enterAnim: Animated.Value }) {
  return (
    <Animated.View style={[S.item, { opacity: enterAnim }]}>
      <View style={S.itemInfo}>
        <Text style={S.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={S.itemUnit}>₹{item.price} / unit</Text>
      </View>
      <View style={S.qtyRow}>
        <TouchableOpacity style={S.qtyBtn} onPress={() => onQtyChange(canteenId, item.id, -1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {item.qty === 1 ? <Trash2 size={14} color={C.red} strokeWidth={2} /> : <Minus size={14} color={C.ink2} strokeWidth={2} />}
        </TouchableOpacity>
        <Text style={S.qtyVal}>{item.qty}</Text>
        <TouchableOpacity style={S.qtyBtn} onPress={() => onQtyChange(canteenId, item.id, 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Plus size={14} color={C.green} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <Text style={S.itemPrice}>₹{item.price * item.qty}</Text>
    </Animated.View>
  );
}

interface PaymentMethod {
  id: PaymentMode;
  label: string;
  icon: typeof Wallet;
  desc: string;
  badge?: string;
}

// ─── Payment option row ───────────────────────────────
function PaymentOption({ method, selected, onSelect }: { method: PaymentMethod; selected: boolean; onSelect: (id: PaymentMode) => void }) {
  const Icon = method.icon;
  const sc = useRef(new Animated.Value(1)).current;

  const press = () => {
    Animated.sequence([
      Animated.timing(sc, { toValue: 0.97, duration: 80, useNativeDriver: false }),
      Animated.spring(sc, { toValue: 1, friction: 5, useNativeDriver: false }),
    ]).start();
    onSelect(method.id);
  };

  return (
    <Animated.View style={{ transform: [{ scale: sc }] }}>
      <TouchableOpacity
        style={[S.payItem, selected && S.payItemSelected]}
        onPress={press}
        activeOpacity={0.85}
      >
        <View style={[S.payIcon, selected && S.payIconActive]}>
          <Icon size={22} color={selected ? "#FFF" : C.action} strokeWidth={2} />
        </View>
        <View style={S.payInfo}>
          <View style={S.payHead}>
            <Text style={S.payLabel}>{method.label}</Text>
            {method.badge && (
              <View style={S.payBadge}>
                <Text style={S.payBadgeTxt}>{method.badge}</Text>
              </View>
            )}
          </View>
          <Text style={S.payDesc}>{method.desc}</Text>
        </View>
        <View style={[S.radioOuter, selected && S.radioOuterActive]}>
          {selected && <Check size={13} color="#FFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────
export default function CheckoutScreen({ navigation }: Props) {
  const { cartGroups, totalAmount, clearCart, totalItemsCount, addToCart, removeFromCart } = useCart();

  const [user, setUser] = useState<User | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("WALLET");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billOpen, setBillOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const placingOrderRef = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // The Payment Method card sits below the fold on most phones, so nothing
  // on first paint hints that it exists -- a customer can reach the bottom
  // bar, tap Place Order, and never notice WALLET was chosen for them by
  // default. The bottom bar carries a tappable "Paying via ..." strip
  // instead, and this ref/offset let it scroll straight to that card.
  const scrollRef = useRef<ScrollView>(null);
  const paymentSectionY = useRef(0);
  const scrollToPayment = () => {
    scrollRef.current?.scrollTo({ y: Math.max(paymentSectionY.current - 12, 0), animated: true });
  };

  useEffect(() => {
    (async () => { setUser(await getUser()); })();
    // The login-time cached balance (user.wallet_balance) goes stale after
    // any order -- fetch the live, authoritative figure so what's shown
    // here actually matches what checkout will try to debit. Best-effort:
    // if it fails, the cached value is still shown as a fallback below.
    getWalletBalance().then(setWalletBalance).catch(() => {});
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
    ]).start();
  }, []);

  // Fees — display-only. The backend recomputes and enforces the
  // authoritative total at order placement (see CLAUDE.md section 9).
  const platformFee = 2;
  const gstAmount = Math.round(totalAmount * 0.05);
  const finalTotal = totalAmount + platformFee + gstAmount;
  const savings = Math.floor(totalAmount * 0.1);

  const estimatedMinutes = useMemo(() => {
    const maxItems = Math.max(
      ...cartGroups.map((g) => g.items.reduce((a, i) => a + i.qty, 0)),
      1
    );
    return Math.min(maxItems * 5 + 10, 45);
  }, [cartGroups]);

  const paymentMethods: PaymentMethod[] = [
    { id: "WALLET", label: "Campus Wallet", icon: Wallet, desc: `Balance: ₹${walletBalance ?? user?.wallet_balance ?? 0}`, badge: "FAST" },
    { id: "UPI", label: "UPI Payment", icon: Smartphone, desc: "Google Pay, PhonePe, Paytm" },
    { id: "CASH", label: "Cash on Pickup", icon: Banknote, desc: "Pay at canteen counter" },
  ];
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMode) ?? paymentMethods[0];
  const SelectedIcon = selectedMethod.icon;

  const handleQtyChange = (canteenId: number, itemId: number, delta: number) => {
    const group = cartGroups.find((g) => g.canteenId === canteenId);
    const item = group?.items.find((i) => i.id === itemId);
    if (!item) return;

    if (delta > 0) {
      addToCart({ ...item, canteenId, canteenName: group!.canteenName });
    } else {
      removeFromCart(itemId, canteenId);
    }
  };

  const handlePlaceOrder = async () => {
    // Guard against a double-tap or a re-render firing this twice while
    // the first request is still in flight. This is UX-level only -- the
    // real protection is the durable Idempotency-Key placeBatchOrder
    // attaches, enforced by the database.
    if (placingOrderRef.current || !user) return;
    placingOrderRef.current = true;

    try {
      setLoading(true);
      setError("");

      const payload = {
        user_id: user.id,
        payment_mode: paymentMode,
        canteens: cartGroups.map((group) => ({
          canteen_id: group.canteenId,
          items: group.items.map((item) => ({ menu_item_id: item.id, quantity: item.qty })),
        })),
      };

      const res = await placeBatchOrder(payload);
      const snapshot = JSON.parse(JSON.stringify(cartGroups));
      clearCart();

      navigation.replace("OrderSuccessScreen", {
        orders: res.orders,
        cartGroups: snapshot,
        totalPrice: finalTotal,
        paymentMode,
      });
    } catch (err: any) {
      // An unknown-outcome error (network failure) must not tell the
      // customer the order failed -- it may have gone through. The
      // idempotency key was kept, so pressing Place Order again is safe
      // and will not duplicate anything.
      setError(err?.unknownOutcome ? err.message : err?.message || "Failed to place order. Please try again.");
    } finally {
      setLoading(false);
      placingOrderRef.current = false;
    }
  };

  if (totalItemsCount === 0) {
    return (
      <AppLayout navigation={navigation} headerBar={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <ScreenHeader title="Checkout" onBack={() => navigation.goBack()} />
        </View>
        <View style={S.emptyWrap}>
          <View style={S.emptyIconWrap}>
            <ShoppingBag size={28} color={C.forest} strokeWidth={1.75} />
          </View>
          <Text style={S.emptyTitle}>Your cart is empty</Text>
          <Text style={S.emptySub}>Add delicious items to get started</Text>
          <TouchableOpacity style={S.emptyBtn} onPress={() => navigation.navigate("CanteenSelectScreen" as never)}>
            <Text style={S.emptyBtnTxt}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout navigation={navigation} headerBar={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <ScreenHeader title="Checkout" onBack={() => navigation.goBack()} />
      </View>
      <StepIndicator />

      <ScrollView ref={scrollRef} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={S.etaCard}>
            <View style={S.etaIcon}>
              <Clock size={20} color="#FFF" strokeWidth={2} />
            </View>
            <View style={S.etaText}>
              <Text style={S.etaLabel}>Ready in ~{estimatedMinutes} mins</Text>
              <Text style={S.etaSub}>Estimated preparation time</Text>
            </View>
            <View style={S.liveBadge}>
              <Text style={S.liveTxt}>LIVE</Text>
            </View>
          </View>

          <View style={S.card}>
            <View style={S.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ShoppingBag size={20} color={C.ink} strokeWidth={2} />
                <Text style={S.cardTitle}>Order Summary</Text>
              </View>
              <View style={S.countBadge}>
                <Text style={S.countBadgeTxt}>{totalItemsCount} items</Text>
              </View>
            </View>

            {cartGroups.map((group) => (
              <View key={group.canteenId} style={S.canteenBlock}>
                <View style={S.canteenHeader}>
                  <View style={S.canteenTile}>
                    <Store size={18} color={C.forest} strokeWidth={1.75} />
                  </View>
                  <Text style={S.canteenName}>{group.canteenName}</Text>
                </View>

                {group.items.map((item) => (
                  <CartItemRow key={item.id} item={item} canteenId={group.canteenId} onQtyChange={handleQtyChange} enterAnim={fadeAnim} />
                ))}
              </View>
            ))}

            <View style={S.bill}>
              <TouchableOpacity style={S.billToggle} onPress={() => setBillOpen(!billOpen)} activeOpacity={0.7}>
                <Text style={S.billToggleTxt}>Bill Details</Text>
                <ChevronRight size={18} color={C.ink2} strokeWidth={2} style={{ transform: [{ rotate: billOpen ? "90deg" : "0deg" }] }} />
              </TouchableOpacity>

              {billOpen && (
                <View style={S.billRows}>
                  <View style={S.billRow}>
                    <Text style={S.billRowTxt}>Item Total</Text>
                    <Text style={S.billRowTxt}>₹{totalAmount}</Text>
                  </View>
                  <View style={S.billRow}>
                    <Text style={S.billRowTxt}>Platform Fee</Text>
                    <Text style={S.billRowTxt}>₹{platformFee}</Text>
                  </View>
                  <View style={S.billRow}>
                    <Text style={S.billRowTxt}>GST (5%)</Text>
                    <Text style={S.billRowTxt}>₹{gstAmount}</Text>
                  </View>
                  <View style={S.savings}>
                    <Text style={S.savingsTxt}>You save ₹{savings}</Text>
                  </View>
                </View>
              )}

              <View style={S.billTotal}>
                <View>
                  <Text style={S.billTotalLbl}>Total Amount</Text>
                  <Text style={S.billTotalSub}>Incl. all taxes</Text>
                </View>
                <Text style={S.billTotalAmt}>₹{finalTotal}</Text>
              </View>
            </View>
          </View>

          <View
            style={[S.card, S.paymentCard]}
            onLayout={(e) => { paymentSectionY.current = e.nativeEvent.layout.y; }}
          >
            <View style={S.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={S.paymentBadge}>
                  <Wallet size={16} color="#FFF" strokeWidth={2.25} />
                </View>
                <View>
                  <Text style={S.cardTitle}>Payment Method</Text>
                  <Text style={S.cardSubtitle}>Choose how you&apos;d like to pay</Text>
                </View>
              </View>
            </View>
            <View style={{ gap: 12 }}>
              {paymentMethods.map((method) => (
                <PaymentOption key={method.id} method={method} selected={paymentMode === method.id} onSelect={setPaymentMode} />
              ))}
            </View>
          </View>

          {error ? (
            <View style={S.errorBox}>
              <Text style={S.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <View style={{ height: 170 }} />
        </Animated.View>
      </ScrollView>

      <View style={S.bottomBar}>
        {/* Always visible, no scrolling required: shows what's actually
            about to be charged and makes clear it can be changed. This is
            the fix for "user has no idea payment options are below". */}
        <TouchableOpacity style={S.paymentStrip} onPress={scrollToPayment} activeOpacity={0.7}>
          <View style={S.paymentStripLeft}>
            <SelectedIcon size={15} color={C.action} strokeWidth={2.25} />
            <Text style={S.paymentStripTxt}>
              Paying via <Text style={S.paymentStripTxtStrong}>{selectedMethod.label}</Text>
            </Text>
          </View>
          <View style={S.paymentStripRight}>
            <Text style={S.paymentStripChange}>Change</Text>
            <ChevronUp size={14} color={C.action} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>

        <View style={S.bottomRow}>
          <View style={S.bottomLeft}>
            <Text style={S.bottomLbl}>Total</Text>
            <Text style={S.bottomTotal}>₹{finalTotal}</Text>
          </View>
          <TouchableOpacity style={[S.placeBtn, loading && S.placeBtnDisabled]} onPress={handlePlaceOrder} disabled={loading} activeOpacity={0.88}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Text style={S.placeBtnTxt}>Place Order</Text>
                <ChevronRight size={18} color="#FFF" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={S.secureRow}>
        <ShieldCheck size={12} color={C.ink3} strokeWidth={2} />
        <Text style={S.secureTxt}>Secured with SSL Encryption</Text>
      </View>
    </AppLayout>
  );
}

// ─── Styles ───────────────────────────────────────────
const S = StyleSheet.create({
  progress: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  step: { alignItems: "center", gap: 5 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: C.surface2, borderWidth: 2, borderColor: C.border,
  },
  stepDotDone: { backgroundColor: C.green, borderColor: C.green },
  stepDotActive: { backgroundColor: C.action, borderColor: C.action },
  stepNum: { fontSize: 13, fontWeight: "700", color: C.ink3 },
  stepLbl: { fontSize: 11, fontWeight: "600", color: C.ink3 },
  stepLine: { width: 48, height: 2, borderRadius: 1, backgroundColor: C.border, marginBottom: 18 },
  stepLineActive: { backgroundColor: C.green },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  etaCard: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: C.surface,
    borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  etaIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.action, alignItems: "center", justifyContent: "center" },
  etaText: { flex: 1 },
  etaLabel: { fontSize: 15, fontWeight: "700", color: C.ink },
  etaSub: { fontSize: 12, color: C.ink2, marginTop: 2 },
  liveBadge: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.green, borderRadius: 20 },
  liveTxt: { fontSize: 11, fontWeight: "800", color: "#FFF", letterSpacing: 0.5 },

  card: {
    backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: C.ink },
  cardSubtitle: { fontSize: 12, color: C.ink3, marginTop: 1 },
  countBadge: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.surface2, borderRadius: 20 },
  countBadgeTxt: { fontSize: 13, fontWeight: "600", color: C.ink2 },

  // Payment card gets its own quiet identity (top accent + icon badge)
  // instead of blending into the stack of plain cards above it.
  paymentCard: { borderTopWidth: 3, borderTopColor: C.action },
  paymentBadge: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: C.action,
    alignItems: "center", justifyContent: "center",
  },

  canteenBlock: { marginBottom: 20 },
  canteenHeader: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  canteenTile: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.actionBg, alignItems: "center", justifyContent: "center" },
  canteenName: { fontSize: 15, fontWeight: "600", color: C.ink },

  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: "600", color: C.ink, marginBottom: 2 },
  itemUnit: { fontSize: 12, color: C.ink3, fontFamily: foodTypography.mono },
  qtyRow: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4,
  },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  qtyVal: { minWidth: 24, textAlign: "center", fontSize: 14, fontWeight: "700", color: C.ink, fontFamily: foodTypography.mono },
  itemPrice: { fontSize: 14, fontWeight: "700", color: C.ink, minWidth: 52, textAlign: "right", fontFamily: foodTypography.mono },

  bill: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: C.border },
  billToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  billToggleTxt: { fontSize: 14, fontWeight: "600", color: C.ink2 },
  billRows: { marginBottom: 4 },
  billRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  billRowTxt: { fontSize: 14, color: C.ink2 },
  savings: { backgroundColor: C.greenBg, padding: 10, borderRadius: 8, marginTop: 4 },
  savingsTxt: { fontSize: 13, fontWeight: "600", color: C.green },
  billTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  billTotalLbl: { fontSize: 15, fontWeight: "700", color: C.ink },
  billTotalSub: { fontSize: 12, color: C.ink3, marginTop: 2 },
  billTotalAmt: { fontSize: 28, fontWeight: "700", color: C.action, fontFamily: foodTypography.mono },

  payItem: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: C.surface2,
    borderWidth: 1.5, borderColor: "transparent", borderRadius: 16,
  },
  payItemSelected: { borderColor: C.action, backgroundColor: C.actionBg, ...foodCardShadow(C.action) },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  radioOuterActive: { borderColor: C.action, backgroundColor: C.action },
  payIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  payIconActive: { backgroundColor: C.action, borderColor: C.action },
  payInfo: { flex: 1 },
  payHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  payLabel: { fontSize: 15, fontWeight: "700", color: C.ink },
  payBadge: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: C.action, borderRadius: 12 },
  payBadgeTxt: { fontSize: 10, fontWeight: "800", color: "#FFF", letterSpacing: 0.5 },
  payDesc: { fontSize: 13, color: C.ink2 },

  errorBox: { padding: 14, borderRadius: 10, backgroundColor: C.redBg, marginBottom: 12 },
  errorTxt: { fontSize: 13, color: C.red, fontWeight: "600" },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.actionBg, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: C.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, color: C.ink2, marginBottom: 24, textAlign: "center" },
  emptyBtn: { height: 48, paddingHorizontal: 32, borderRadius: 10, backgroundColor: C.action, alignItems: "center", justifyContent: "center" },
  emptyBtnTxt: { fontSize: 15, fontWeight: "600", color: "#FFF" },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 28 : 16,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  // The affordance that solves "no idea payment options are below": always
  // on screen, states the actual choice in plain words, and doubles as a
  // shortcut back to the card instead of a silent scroll requirement.
  paymentStrip: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: C.actionBg, borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  paymentStripLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  paymentStripTxt: { fontSize: 12.5, color: C.ink2 },
  paymentStripTxtStrong: { fontWeight: "700", color: C.ink },
  paymentStripRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  paymentStripChange: { fontSize: 12, fontWeight: "700", color: C.action },
  bottomRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 16 },
  bottomLeft: { flex: 1 },
  bottomLbl: { fontSize: 12, color: C.ink3 },
  bottomTotal: { fontSize: 26, fontWeight: "700", color: C.ink, fontFamily: foodTypography.mono },
  placeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48,
    paddingHorizontal: 24, backgroundColor: C.action, borderRadius: 10,
  },
  placeBtnDisabled: { opacity: 0.7 },
  placeBtnTxt: { fontSize: 15, fontWeight: "700", color: "#FFF" },

  secureRow: {
    position: "absolute", bottom: Platform.OS === "ios" ? 6 : 2, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingBottom: 2, backgroundColor: C.surface,
  },
  secureTxt: { fontSize: 11, color: C.ink3 },
});

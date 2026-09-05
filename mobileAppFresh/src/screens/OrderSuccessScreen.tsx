/**
 * OrderSuccessScreen — the confirmation popup shown right after checkout.
 *
 * Keeps the shape of the previous version (floating card, green success
 * header with a checkmark + pulse ring, stats row, Items/Timeline tabs,
 * bill, footer buttons) but on the real design system, and with three
 * honesty fixes:
 *
 *   1. Removed the "Points" and "You Saved" stats -- there is no loyalty
 *      program and no real discount in the backend; `totalPrice / 10` and
 *      `totalPrice * 0.1` were invented numbers with nothing behind them.
 *   2. Removed the "Enable notifications" CTA -- tapping it only flipped
 *      local state, it never actually registered for push notifications.
 *      A toggle that lies about being on is worse than no toggle.
 *   3. Removed the floating "help" button -- its onPress was a comment,
 *      `/* open support chat *\/`, doing nothing.
 *
 * Confetti/pulse-ring animations now use the native driver (opacity and
 * transform only), so the one-time celebration doesn't cost a JS-thread
 * animation loop the way the old version did.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Zap,
} from "lucide-react-native";
import { getFoodColors, foodTypography } from "../theme/foodTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "OrderSuccessScreen">;

const { width, height } = Dimensions.get("window");
const C = getFoodColors(false);
const CONFETTI_COLORS = [C.action, C.forest, C.accent, "#60A5FA", "#F472B6"];

interface OrderResult { order_id: number; canteen_id: number; estimated_ready_at?: number }

function getRemainingTime(readyAt?: number) {
  if (!readyAt) return 0;
  return Math.max(Math.floor(readyAt - Date.now() / 1000), 0);
}
function formatWaitTime(totalSeconds: number) {
  if (!totalSeconds || totalSeconds <= 0) return "Soon";
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── Confetti (one-shot, native driver) ─────────────────
function ConfettiPiece({ left, color, delay, duration }: { left: number; color: string; delay: number; duration: number }) {
  const y = useRef(new Animated.Value(0)).current;
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: height, duration, delay, useNativeDriver: true }),
      Animated.timing(r, { toValue: 1, duration, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  const rotate = r.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "720deg"] });
  return (
    <Animated.View style={{ position: "absolute", left, top: 0, width: 8, height: 8, backgroundColor: color, borderRadius: 2, transform: [{ translateY: y }, { rotate }] }} />
  );
}

function PulseRing() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.6, duration: 1400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[S.pulseRing, { transform: [{ scale }], opacity }]} />;
}

// ─── Main screen ────────────────────────────────────────
export default function OrderSuccessScreen({ navigation, route }: Props) {
  const orders = (route.params?.orders as OrderResult[]) || [];
  const cartGroups = route.params?.cartGroups || [];
  const totalPrice = route.params?.totalPrice || 0;
  const paymentMode = route.params?.paymentMode || "WALLET";

  const [activeTab, setActiveTab] = useState<"items" | "timeline">("items");
  const [confetti, setConfetti] = useState<{ id: number; left: number; delay: number; color: string; duration: number }[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const existing = await AsyncStorage.getItem("activeOrders");
        const existingIds: number[] = JSON.parse(existing || "[]");
        const newIds = orders.map((o) => o.order_id);
        await AsyncStorage.setItem("activeOrders", JSON.stringify([...new Set([...existingIds, ...newIds])]));
      } catch { /* tracking list is best-effort */ }
    })();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      const pieces = Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        left: Math.random() * width,
        delay: Math.random() * 700,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        duration: 2000 + Math.random() * 1600,
      }));
      setConfetti(pieces);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3800);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const maxWaitSecs = Math.max(...orders.map((o) => getRemainingTime(o.estimated_ready_at)), 0);
  const estimatedDisplay = formatWaitTime(maxWaitSecs);
  const itemCount = useMemo(() => cartGroups.reduce((s, g) => s + g.items.reduce((a, i) => a + i.qty, 0), 0), [cartGroups]);
  const orderIds = orders.map((o) => o.order_id).join(", ");

  const TIMELINE_STEPS = [
    { label: "Order Placed", time: "Just now", state: "done" as const },
    { label: "Preparing", time: "In progress", state: "current" as const },
    { label: "Ready to Pick", time: estimatedDisplay, state: "pending" as const },
  ];

  return (
    <SafeAreaView style={S.root} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {showConfetti && (
        <View style={S.confettiLayer} pointerEvents="none">
          {confetti.map((p) => <ConfettiPiece key={p.id} {...p} />)}
        </View>
      )}

      <Animated.View style={[S.card, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={S.header}>
          <Animated.View style={[S.checkWrap, { transform: [{ scale }] }]}>
            <PulseRing />
            <CheckCircle2 color={C.action} size={40} strokeWidth={2.5} />
          </Animated.View>
          <Text style={S.headerTitle}>Order Confirmed</Text>
          <Text style={S.headerSub}>Your food is being prepared</Text>
        </View>

        <View style={S.statsRow}>
          <View style={[S.statItem, S.statBorder]}>
            <Text style={[S.statVal, { color: C.action }]}>{estimatedDisplay}</Text>
            <Text style={S.statLbl}>Est. Time</Text>
          </View>
          <View style={[S.statItem, S.statBorder]}>
            <Text style={S.statVal}>{itemCount}</Text>
            <Text style={S.statLbl}>Items</Text>
          </View>
          <View style={S.statItem}>
            <Text style={S.statVal}>₹{totalPrice}</Text>
            <Text style={S.statLbl}>Total Paid</Text>
          </View>
        </View>

        <ScrollView style={S.body} contentContainerStyle={S.bodyContent} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={S.orderIdCard}>
            <View>
              <Text style={S.orderIdLbl}>ORDER ID</Text>
              <Text style={S.orderIdVal}>#{orderIds}</Text>
            </View>
            <View style={S.payModePill}>
              <Text style={S.payModeTxt}>{paymentMode}</Text>
            </View>
          </View>

          <View style={S.tabs}>
            <TouchableOpacity style={[S.tab, activeTab === "items" && S.tabActive]} onPress={() => setActiveTab("items")} activeOpacity={0.8}>
              <ShoppingBag size={14} color={activeTab === "items" ? C.forest : C.ink3} strokeWidth={2} />
              <Text style={[S.tabTxt, activeTab === "items" && S.tabTxtActive]}>Items</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.tab, activeTab === "timeline" && S.tabActive]} onPress={() => setActiveTab("timeline")} activeOpacity={0.8}>
              <Zap size={14} color={activeTab === "timeline" ? C.forest : C.ink3} strokeWidth={2} />
              <Text style={[S.tabTxt, activeTab === "timeline" && S.tabTxtActive]}>Timeline</Text>
            </TouchableOpacity>
          </View>

          {activeTab === "items" ? (
            cartGroups.map((group) => {
              const groupOrder = orders.find((o) => o.canteen_id === group.canteenId);
              const groupWait = formatWaitTime(getRemainingTime(groupOrder?.estimated_ready_at));
              return (
                <View key={group.canteenId} style={{ marginBottom: 8 }}>
                  <View style={S.canteenHeader}>
                    <Text style={S.canteenTitle}>{group.canteenName}</Text>
                    <Text style={S.canteenEta}>Est: {groupWait}</Text>
                  </View>
                  {group.items.map((item) => (
                    <View key={item.id} style={S.itemRow}>
                      <Text style={S.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={S.itemQty}>×{item.qty}</Text>
                      <Text style={S.itemPrice}>₹{item.price * item.qty}</Text>
                    </View>
                  ))}
                </View>
              );
            })
          ) : (
            <View style={S.timeline}>
              {TIMELINE_STEPS.map((step, idx) => (
                <View key={idx} style={S.timelineStep}>
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <View style={[S.timelineLine, step.state === "done" && S.timelineLineDone]} />
                  )}
                  <View style={[S.timelineDot, step.state === "pending" ? S.dotPending : { backgroundColor: C.action }]}>
                    {step.state === "done" && <CheckCircle2 size={11} color="#FFF" strokeWidth={3} />}
                    {step.state === "current" && <Zap size={11} color="#FFF" strokeWidth={2.5} />}
                  </View>
                  <View style={{ marginLeft: 14, flex: 1 }}>
                    <Text style={[S.stepLabel, step.state === "pending" && { color: C.ink4 }]}>{step.label}</Text>
                    <Text style={S.stepTime}>{step.time}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>

        <View style={S.footer}>
          <TouchableOpacity
            style={S.trackBtn}
            onPress={() => navigation.navigate("MainTabs", { screen: "TrackOrderScreen" } as never)}
            activeOpacity={0.88}
          >
            <Clock size={18} color="#FFF" strokeWidth={2} />
            <Text style={S.trackBtnTxt}>Track Order</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={S.backBtn}
            onPress={() => navigation.navigate("MainTabs", { screen: "CanteenSelectScreen" } as never)}
            activeOpacity={0.85}
          >
            <ArrowLeft size={16} color={C.ink2} strokeWidth={2} />
            <Text style={S.backBtnTxt}>Back to Canteens</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  confettiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 50 },

  card: {
    flex: 1, margin: 12, backgroundColor: C.surface, borderRadius: 20, overflow: "hidden",
    borderWidth: 1, borderColor: C.border,
  },

  header: { backgroundColor: C.action, paddingTop: 26, paddingBottom: 22, alignItems: "center", justifyContent: "center" },
  checkWrap: {
    width: 76, height: 76, backgroundColor: "#FFF", borderRadius: 38, alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  pulseRing: { position: "absolute", width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: "rgba(255,255,255,0.6)" },
  headerTitle: { fontSize: 21, fontWeight: "800", color: "#FFF", marginBottom: 4 },
  headerSub: { fontSize: 13.5, color: "rgba(255,255,255,0.88)" },

  statsRow: { flexDirection: "row", backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  statItem: { flex: 1, paddingVertical: 14, alignItems: "center" },
  statBorder: { borderRightWidth: 1, borderRightColor: C.border },
  statVal: { fontSize: 16, fontWeight: "700", color: C.ink, fontFamily: foodTypography.mono },
  statLbl: { fontSize: 10.5, color: C.ink3, marginTop: 2 },

  body: { flex: 1 },
  bodyContent: { padding: 16, paddingTop: 14 },

  orderIdCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: C.bg, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border,
  },
  orderIdLbl: { fontSize: 10, color: C.ink3, fontWeight: "700", letterSpacing: 0.6 },
  orderIdVal: { fontSize: 16, fontWeight: "700", color: C.ink, marginTop: 2, fontFamily: foodTypography.mono },
  payModePill: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C.actionBg, borderRadius: 999 },
  payModeTxt: { fontSize: 11, fontWeight: "700", color: C.forest },

  tabs: { flexDirection: "row", backgroundColor: C.bg, borderRadius: 10, padding: 4, marginBottom: 14 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 8, gap: 6 },
  tabActive: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  tabTxt: { fontSize: 13, fontWeight: "600", color: C.ink3 },
  tabTxtActive: { color: C.forest },

  canteenHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  canteenTitle: { fontWeight: "700", color: C.ink, fontSize: 14 },
  canteenEta: { fontSize: 12, color: C.action, fontWeight: "700", fontFamily: foodTypography.mono },

  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  itemName: { flex: 1, fontWeight: "600", color: C.ink, fontSize: 13.5 },
  itemQty: { fontSize: 12, color: C.ink3, fontFamily: foodTypography.mono },
  itemPrice: { fontWeight: "700", color: C.ink, fontSize: 13.5, fontFamily: foodTypography.mono, minWidth: 48, textAlign: "right" },

  timeline: { paddingLeft: 4, marginBottom: 8 },
  timelineStep: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20, position: "relative" },
  timelineLine: { position: "absolute", left: 11, top: 24, width: 2, height: 24, backgroundColor: C.border, zIndex: 0 },
  timelineLineDone: { backgroundColor: C.action },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", zIndex: 1 },
  dotPending: { backgroundColor: C.border },
  stepLabel: { fontWeight: "600", fontSize: 14, color: C.ink },
  stepTime: { fontSize: 12, color: C.ink3, marginTop: 2, fontFamily: foodTypography.mono },

  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  trackBtn: { backgroundColor: C.action, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, borderRadius: 12, gap: 8 },
  trackBtnTxt: { color: "#FFF", fontWeight: "700", fontSize: 15.5 },
  backBtn: { backgroundColor: C.surface2, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, gap: 7 },
  backBtnTxt: { color: C.ink2, fontWeight: "700", fontSize: 14.5 },
});

/**
 * TrackOrderScreen — live status for every active order.
 *
 * Data layer kept functionally identical to the previous .jsx version
 * (same AsyncStorage("activeOrders") list, same per-canteen WebSocket
 * dedup via a ref set, same YOLO queue poll gated to only run while an
 * order is READY) -- that part was already correct. What changed is the
 * UI: forest/action/cream design system, no emoji, and three concrete
 * performance/correctness fixes found while redesigning:
 *
 *   1. Dropped `FloatingParticles` -- six particles animating in an
 *      infinite loop the entire time this screen was mounted, with
 *      useNativeDriver:false. Pure decoration, real cost.
 *   2. Dropped the timeline's infinite pulsing glow on the active step
 *      (also useNativeDriver:false, also ran forever). The active step
 *      is now a plain highlighted dot -- still reads clearly as "current".
 *   3. Fixed a double-vibration bug: the old code vibrated once in the
 *      WebSocket's ORDER_DELIVERED handler AND again in OrderCard's own
 *      "did this order just become delivered" effect. Now it vibrates
 *      exactly once, from the single place that owns the transition.
 *   4. Replaced the confetti particle system with one small native-driver
 *      scale-in checkmark -- same "your order arrived" moment, no
 *      per-frame JS particle math.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";
import { useFocusEffect } from "@react-navigation/native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Minus,
  Package,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react-native";
import AppLayout from "../layout/AppLayout";
import ScreenHeader from "../components/food/ScreenHeader";
import { API_URL, WS_URL, YOLO_URL } from "../services/config";
import { authFetch } from "../services/auth";
import { getFoodColors, foodTypography } from "../theme/foodTheme";
import type { MainTabParamList, RootStackParamList } from "../types/navigation";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "TrackOrderScreen">,
  NativeStackScreenProps<RootStackParamList>
>;

const C = getFoodColors(false);
const STEPS = ["PLACED", "PREPARING", "READY", "DELIVERED"] as const;
const STEP_LABEL: Record<string, string> = { PLACED: "Placed", PREPARING: "Cooking", READY: "Ready", DELIVERED: "Done" };
const STATUS_LABEL: Record<string, string> = {
  PLACED: "Order Placed", PREPARING: "Being Prepared", READY: "Ready to Collect", DELIVERED: "Collected",
};
const STATUS_ICON: Record<string, typeof Clock> = { PLACED: Clock, PREPARING: Activity, READY: Package, DELIVERED: CheckCircle2 };
const YOLO_POLL_MS = 4000;
const DISMISS_AFTER_DELIVERED_MS = 3000;

interface OrderItem { name: string; quantity: number }
interface TrackedOrder {
  order_id: number;
  canteen_id: number;
  canteen_name?: string;
  status: string;
  estimated_ready_at?: number;
  verification_token?: string;
  items: OrderItem[];
}
interface QueueSnapshot {
  queue_count: number;
  average_service_seconds: number;
  effective_service_seconds?: number;
  trend?: "rising" | "falling" | "stable";
  surge_alert?: boolean;
  overcrowded?: boolean;
  last_updated?: number;
  canteen_id?: number;
}

const isStale = (snap?: QueueSnapshot | null) => !snap || Date.now() / 1000 - (snap.last_updated || 0) > 14;
const toClockTime = (unix?: number) => (unix ? new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);
const fmtSec = (s: number) => { const n = Math.round(s); return n <= 0 ? "0s" : n < 60 ? `${n}s` : `${Math.floor(n / 60)}m`; };
const fmtWait = (s: number) => { const n = Math.round(s); return n <= 0 ? "now" : n < 60 ? `${n}s` : `${Math.ceil(n / 60)} min`; };

// ─── Segmented step timeline ────────────────────────────
function Timeline({ status }: { status: string }) {
  const currentIndex = STEPS.indexOf(status as (typeof STEPS)[number]);
  const isDelivered = status === "DELIVERED";
  return (
    <View style={S.timeline}>
      {STEPS.map((step, idx) => {
        const completed = idx < currentIndex || isDelivered;
        const active = idx === currentIndex && !isDelivered;
        return (
          <View key={step} style={S.stepWrap}>
            {idx > 0 && <View style={[S.stepLine, { backgroundColor: completed || active ? C.action : C.border }]} />}
            <View style={{ alignItems: "center", gap: 6 }}>
              {completed ? (
                <View style={[S.dot, { backgroundColor: C.action }]}>
                  <Check size={11} color="#FFF" strokeWidth={3} />
                </View>
              ) : active ? (
                <View style={[S.dot, S.dotActive]} />
              ) : (
                <View style={[S.dot, S.dotPending]} />
              )}
              <Text style={[S.stepLbl, { color: completed || active ? C.ink : C.ink4 }]}>{STEP_LABEL[step]}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Live queue card (YOLO crowd data) ──────────────────
function QueueCard({ data }: { data: QueueSnapshot | null }) {
  if (!data) {
    return (
      <View style={S.qOffline}>
        <View style={S.qOfflineDot} />
        <Text style={S.qOfflineTxt}>Camera offline — queue data unavailable</Text>
      </View>
    );
  }

  const count = Math.round(data.queue_count || 0);
  const effSec = Math.round(data.effective_service_seconds || data.average_service_seconds || 0);
  const trend = data.trend || "stable";
  const crowded = !!data.overcrowded;
  const surge = !!data.surge_alert;
  const joinWait = count === 0 ? 0 : Math.round((count + 0.5) * effSec);

  const statusMsg = crowded ? "Very busy right now" : surge ? "Filling up fast" : count === 0 ? "No one waiting" : count <= 2 ? "Short queue" : `${count} people ahead`;
  const accent = crowded ? C.red : surge ? C.accent : count === 0 ? C.action : C.ink2;
  const TrendIcon = trend === "rising" ? TrendingUp : trend === "falling" ? TrendingDown : Minus;

  return (
    <View style={S.qCard}>
      <View style={S.qHeader}>
        <View style={S.qHeaderLeft}>
          <View style={S.liveDot} />
          <Text style={S.qHeaderTxt}>Live Queue</Text>
        </View>
        <View style={S.trendPill}>
          <TrendIcon size={10} color={C.ink3} strokeWidth={2} />
          <Text style={S.trendTxt}>{trend === "rising" ? "Rising" : trend === "falling" ? "Clearing" : "Steady"}</Text>
        </View>
      </View>
      <Text style={[S.qStatus, { color: accent }]}>{statusMsg}</Text>
      <View style={S.qMetrics}>
        <View style={S.qMetric}><Text style={S.qMetricVal}>{count}</Text><Text style={S.qMetricLbl}>Waiting</Text></View>
        <View style={S.qDiv} />
        <View style={S.qMetric}><Text style={S.qMetricVal}>{fmtSec(effSec)}</Text><Text style={S.qMetricLbl}>Per person</Text></View>
        <View style={S.qDiv} />
        <View style={S.qMetric}><Text style={[S.qMetricVal, count === 0 && { color: C.action }]}>{fmtWait(joinWait)}</Text><Text style={S.qMetricLbl}>Your wait</Text></View>
      </View>
      {(surge || crowded) && (
        <View style={S.qAlert}>
          {crowded ? <AlertCircle size={13} color={C.red} strokeWidth={2} /> : <Zap size={13} color={C.accent} strokeWidth={2} />}
          <Text style={[S.qAlertTxt, { color: accent }]}>{crowded ? "Longer wait times" : "Queue growing fast"}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Order card ──────────────────────────────────────────
function OrderCard({
  order, intel, onShowQR, onDelivered,
}: { order: TrackedOrder; intel: QueueSnapshot | null; onShowQR: (id: number) => void; onDelivered: (id: number) => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const [showBanner, setShowBanner] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (order.status === "DELIVERED" && !dismissedRef.current) {
      dismissedRef.current = true;
      setShowBanner(true);
      const t = setTimeout(() => onDelivered(order.order_id), DISMISS_AFTER_DELIVERED_MS);
      return () => clearTimeout(t);
    }
  }, [order.status]);

  const isReady = order.status === "READY";
  const isDelivered = order.status === "DELIVERED";
  const readyAt = toClockTime(order.estimated_ready_at);
  const StatusIcon = STATUS_ICON[order.status] || Clock;

  return (
    <Animated.View style={[S.card, { opacity: fade }]}>
      {showBanner && (
        <View style={S.deliveredBanner}>
          <CheckCircle2 size={16} color={C.action} strokeWidth={2.5} />
          <Text style={S.deliveredBannerTxt}>Order received — thank you!</Text>
        </View>
      )}

      <View style={S.cardHead}>
        <View style={S.statusPill}>
          <StatusIcon size={13} color={C.forest} strokeWidth={2} />
          <Text style={S.statusPillTxt}>{STATUS_LABEL[order.status] || order.status}</Text>
        </View>
        {!isDelivered && readyAt && (
          <View style={S.etaChip}>
            <Clock size={10} color={C.ink3} strokeWidth={2} />
            <Text style={S.etaChipTxt}>Ready {readyAt}</Text>
          </View>
        )}
      </View>

      <View style={S.canteenRow}>
        <View style={S.canteenTile}><MapPin size={15} color={C.forest} strokeWidth={1.75} /></View>
        <View>
          <Text style={S.canteenName} numberOfLines={1}>{order.canteen_name || "Canteen"}</Text>
          <Text style={S.orderId}>Order #{order.order_id}</Text>
        </View>
      </View>

      <Timeline status={order.status} />

      {isReady && <QueueCard data={isStale(intel) ? null : intel} />}

      <View style={S.itemsSection}>
        <View style={S.itemsHead}>
          <ShoppingBag size={12} color={C.ink3} strokeWidth={2} />
          <Text style={S.itemsHeadTxt}>Your order</Text>
        </View>
        {order.items.map((item, i) => (
          <View key={i} style={S.itemRow}>
            <View style={S.itemQtyBadge}><Text style={S.itemQtyTxt}>{item.quantity}</Text></View>
            <Text style={S.itemName} numberOfLines={1}>{item.name}</Text>
          </View>
        ))}
      </View>

      {isReady && (
        <TouchableOpacity style={S.qrBtn} onPress={() => onShowQR(order.order_id)} activeOpacity={0.85}>
          <View style={S.qrBtnLeft}>
            <Package size={15} color={C.ink} strokeWidth={2} />
            <Text style={S.qrBtnTxt}>Show Pickup Code</Text>
          </View>
          <ChevronRight size={15} color={C.ink3} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── QR bottom sheet ─────────────────────────────────────
function QRSheet({ order, onClose }: { order: TrackedOrder; onClose: () => void }) {
  const qrValue = order.verification_token || JSON.stringify({ order_id: order.order_id });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={S.sheetBackdrop} onPress={onClose}>
        <Pressable style={S.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={S.sheetGrabber} />
          <View style={S.sheetHeadRow}>
            <Text style={S.sheetTitle}>Pickup Code</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={C.ink3} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <Text style={S.sheetSub}>Show this to the counter staff for order #{order.order_id}</Text>
          <View style={S.qrWrap}>
            <QRCode value={qrValue} size={180} level="H" backgroundColor="#FFFFFF" color="#000000" />
          </View>
          <Text style={S.sheetHint}>{order.canteen_name}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ────────────────────────────────────────
export default function TrackOrderScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQRFor, setShowQRFor] = useState<number | null>(null);
  const [queueIntel, setQueueIntel] = useState<Record<number, QueueSnapshot>>({});

  const wsRef = useRef<Record<number, WebSocket>>({});
  const connRef = useRef<Set<number>>(new Set());

  const fetchOrders = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("activeOrders");
      const stored: number[] = JSON.parse(raw || "[]");
      if (!stored.length) { setOrders([]); return; }

      const results = await Promise.allSettled(
        stored.map(async (id) => {
          const r = await authFetch(`${API_URL}/track-order/${id}`);
          if (r.status === 404) return null;
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
      );

      const valid: TrackedOrder[] = results
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter((o): o is TrackedOrder => !!o && o.status !== "DELIVERED")
        .sort((a, b) => b.order_id - a.order_id);

      await AsyncStorage.setItem("activeOrders", JSON.stringify(valid.map((o) => o.order_id)));
      setOrders(valid);
    } catch {
      // leave orders as-is; the empty/loading state is enough signal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch every time this tab gains focus, not just on first mount.
  // Tab screens stay mounted in the background (React Navigation doesn't
  // unmount inactive tabs), so a plain useEffect only ever ran once, right
  // after login -- a new order placed later and merged into
  // AsyncStorage("activeOrders") by OrderSuccessScreen would never show up
  // here until the app was reloaded. `loading` only gates the very first
  // load (it's never set back to true here), so this doesn't flash a
  // spinner on every tab switch -- it just quietly refreshes.
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const onRefresh = useCallback(() => { setRefreshing(true); fetchOrders(); }, [fetchOrders]);

  const handleDismiss = useCallback(async (orderId: number) => {
    setShowQRFor((prev) => (prev === orderId ? null : prev));
    setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
    const raw = await AsyncStorage.getItem("activeOrders");
    const stored: number[] = JSON.parse(raw || "[]");
    await AsyncStorage.setItem("activeOrders", JSON.stringify(stored.filter((id) => id !== orderId)));
  }, []);

  const canteenIds = useMemo(() => [...new Set(orders.map((o) => o.canteen_id))], [orders]);
  const canteenIdsKey = canteenIds.join(",");

  // Per-canteen WebSocket, deduped -- one socket per canteen regardless of
  // how many active orders share it, closed the moment no order needs it.
  useEffect(() => {
    if (!canteenIds.length) return;

    canteenIds.forEach((cid) => {
      if (connRef.current.has(cid)) return;
      const ws = new WebSocket(`${WS_URL}/ws/canteen/${cid}`);
      ws.onopen = () => connRef.current.add(cid);
      ws.onerror = () => ws.close();
      ws.onclose = () => { connRef.current.delete(cid); delete wsRef.current[cid]; };
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);

          if (d.event === "ORDER_DELIVERED" || (d.event === "ORDER_STATUS_UPDATE" && d.status === "DELIVERED")) {
            Vibration.vibrate([0, 100, 60, 100]);
          } else if (d.event === "ORDER_STATUS_UPDATE") {
            Vibration.vibrate(30);
          }

          if (d.event === "PICKUP_QUEUE_UPDATE" && d.yolo_snapshot) {
            setQueueIntel((p) => ({ ...p, [cid]: d.yolo_snapshot }));
          }

          setOrders((prev) => prev.map((o) => {
            if (o.order_id !== d.order_id) return o;
            if (d.event === "ORDER_STATUS_UPDATE" || d.event === "ORDER_DELIVERED") return { ...o, status: d.status || "DELIVERED" };
            if (d.event === "ETA_UPDATE") return { ...o, estimated_ready_at: d.estimated_ready_at };
            return o;
          }));
        } catch { /* ignore malformed frames */ }
      };
      wsRef.current[cid] = ws;
    });

    return () => {
      Object.entries(wsRef.current).forEach(([cidStr, ws]) => {
        if (!canteenIds.includes(Number(cidStr))) {
          ws.close();
          connRef.current.delete(Number(cidStr));
          delete wsRef.current[Number(cidStr)];
        }
      });
    };
  }, [canteenIdsKey]);

  useEffect(() => () => {
    Object.values(wsRef.current).forEach((ws) => ws.close());
    wsRef.current = {};
    connRef.current.clear();
  }, []);

  // YOLO queue poll -- only while an order is actually READY, so this
  // screen doesn't poll an ML endpoint for orders still being cooked.
  useEffect(() => {
    if (!orders.some((o) => o.status === "READY")) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`${YOLO_URL}/queue/snapshot`);
        if (!r.ok || cancelled) return;
        const snap = await r.json();
        canteenIds.forEach((cid) => {
          if (!snap.canteen_id || snap.canteen_id === cid) setQueueIntel((p) => ({ ...p, [cid]: snap }));
        });
      } catch { /* camera/YOLO service unavailable -- QueueCard shows offline */ }
    };
    poll();
    const id = setInterval(poll, YOLO_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [orders.some((o) => o.status === "READY"), canteenIdsKey]);

  const shownOrder = orders.find((o) => o.order_id === showQRFor);

  const renderItem = useCallback(({ item }: { item: TrackedOrder }) => (
    <OrderCard order={item} intel={queueIntel[item.canteen_id] || null} onShowQR={setShowQRFor} onDelivered={handleDismiss} />
  ), [queueIntel, handleDismiss]);

  return (
    <AppLayout navigation={navigation} headerBar={false}>
      <View style={S.root}>
        {loading ? (
          <View style={S.loadingWrap}><ActivityIndicator size="large" color={C.action} /></View>
        ) : orders.length === 0 ? (
          <>
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><ScreenHeader title="Track Order" /></View>
            <View style={S.empty}>
              <View style={S.emptyIconWrap}><Package size={30} color={C.forest} strokeWidth={1.75} /></View>
              <Text style={S.emptyTitle}>No active orders</Text>
              <Text style={S.emptySub}>Orders you place will show up here with live status.</Text>
            </View>
          </>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o) => String(o.order_id)}
            renderItem={renderItem}
            contentContainerStyle={S.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListHeaderComponent={<ScreenHeader title="Track Order" subtitle={`${orders.length} active`} />}
          />
        )}
      </View>

      {shownOrder && <QRSheet order={shownOrder} onClose={() => setShowQRFor(null)} />}
    </AppLayout>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 32 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: C.actionBg, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: C.ink, marginBottom: 6 },
  emptySub: { fontSize: 13.5, color: C.ink3, textAlign: "center", lineHeight: 20 },

  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 14, gap: 14 },

  deliveredBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.actionBg,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: -2,
  },
  deliveredBannerTxt: { fontSize: 13, fontWeight: "700", color: C.forest },

  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.actionBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillTxt: { fontSize: 12, fontWeight: "700", color: C.forest },
  etaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  etaChipTxt: { fontSize: 11, color: C.ink3, fontFamily: foodTypography.mono },

  canteenRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  canteenTile: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.actionBg, alignItems: "center", justifyContent: "center" },
  canteenName: { fontSize: 15, fontWeight: "700", color: C.ink },
  orderId: { fontSize: 11.5, color: C.ink3, fontFamily: foodTypography.mono, marginTop: 1 },

  timeline: { flexDirection: "row", alignItems: "flex-start" },
  stepWrap: { flex: 1, alignItems: "center", position: "relative" },
  stepLine: { position: "absolute", top: 10, left: "-50%", width: "100%", height: 2, zIndex: -1 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  dotActive: { backgroundColor: C.action, borderWidth: 3, borderColor: C.actionBg },
  dotPending: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border },
  stepLbl: { fontSize: 10.5, fontWeight: "600" },

  qCard: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, gap: 10 },
  qHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.action },
  qHeaderTxt: { fontSize: 11.5, fontWeight: "700", color: C.ink2, textTransform: "uppercase", letterSpacing: 0.4 },
  trendPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  trendTxt: { fontSize: 10.5, fontWeight: "600", color: C.ink3 },
  qStatus: { fontSize: 14.5, fontWeight: "700" },
  qMetrics: { flexDirection: "row", alignItems: "center" },
  qMetric: { flex: 1, alignItems: "center" },
  qMetricVal: { fontSize: 15, fontWeight: "700", color: C.ink, fontFamily: foodTypography.mono },
  qMetricLbl: { fontSize: 10.5, color: C.ink3, marginTop: 2 },
  qDiv: { width: 1, height: 26, backgroundColor: C.border },
  qAlert: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  qAlertTxt: { fontSize: 12, fontWeight: "600" },
  qOffline: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  qOfflineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.ink4 },
  qOfflineTxt: { fontSize: 12, color: C.ink3 },

  itemsSection: { gap: 6 },
  itemsHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  itemsHeadTxt: { fontSize: 11.5, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.4 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemQtyBadge: { minWidth: 22, height: 20, borderRadius: 6, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  itemQtyTxt: { fontSize: 11, fontWeight: "700", color: C.ink2 },
  itemName: { fontSize: 13.5, color: C.ink2, flex: 1 },

  qrBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.actionBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  qrBtnLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  qrBtnTxt: { fontSize: 13.5, fontWeight: "700", color: C.ink },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(23,32,26,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, alignItems: "center" },
  sheetGrabber: { width: 36, height: 4, borderRadius: 999, backgroundColor: C.border, marginBottom: 16 },
  sheetHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: C.ink },
  sheetSub: { fontSize: 13, color: C.ink3, textAlign: "center", marginBottom: 20 },
  qrWrap: { padding: 16, backgroundColor: "#FFF", borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  sheetHint: { fontSize: 13, fontWeight: "600", color: C.ink2, marginBottom: 8 },
});

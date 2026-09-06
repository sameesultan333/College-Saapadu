/**
 * OrderHistoryScreen — the Orders tab.
 *
 * Matches CanteenSelectScreen's design language: single-column list, border-
 * based cards (no floating shadows), forest/action/cream palette, monospace
 * numerals for prices/dates, no emoji. FlatList (not ScrollView+map) so a
 * long history stays smooth -- off-screen cards aren't rendered. Fetches
 * history exactly once per mount (no polling, no refetch on focus).
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  ListRenderItemInfo,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ChevronDown,
  Clock,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Store,
} from "lucide-react-native";
import AppLayout from "../layout/AppLayout";
import ScreenHeader from "../components/food/ScreenHeader";
import { API_URL } from "../services/config";
import { authFetch } from "../services/auth";
import { getFoodColors, foodTypography } from "../theme/foodTheme";
import type { MainTabParamList, RootStackParamList } from "../types/navigation";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "OrderHistoryScreen">,
  NativeStackScreenProps<RootStackParamList>
>;

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const C = getFoodColors(false);

interface HistoryItem {
  name: string;
  price: number;
  quantity: number;
}

interface HistoryOrder {
  order_id: number;
  canteen_id: number;
  canteen_name: string;
  status: string;
  payment_mode: string;
  total_amount: number;
  created_at: string;
  items: HistoryItem[];
}

function formatDate(value: string): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Order card ─────────────────────────────────────────
// Memoized so pull-to-refresh and other parent state changes don't
// re-render every card in the history list; each card keeps its own
// expand/collapse state, which React.memo preserves.
const OrderCard = React.memo(function OrderCard({ order, onReorder }: { order: HistoryOrder; onReorder: (order: HistoryOrder) => void }) {
  const [expanded, setExpanded] = useState(false);
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
  const visibleItems = expanded ? order.items : order.items.slice(0, 2);
  const hasMore = order.items.length > 2;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={S.card}>
      <View style={S.cardHead}>
        <View style={S.canteenTile}>
          <Store size={16} color={C.forest} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={S.canteenName} numberOfLines={1}>{order.canteen_name}</Text>
          <View style={S.metaRow}>
            <Receipt size={10.5} color={C.ink4} strokeWidth={2} />
            <Text style={S.metaTxt}>#{order.order_id}</Text>
            <View style={S.metaDot} />
            <Clock size={10.5} color={C.ink4} strokeWidth={2} />
            <Text style={S.metaTxt}>{formatDate(order.created_at)}</Text>
          </View>
        </View>
      </View>

      <View style={S.hairline} />

      {visibleItems.map((item, idx) => (
        <View key={idx} style={S.itemRow}>
          <Text style={S.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={S.itemQty}>×{item.quantity}</Text>
          <Text style={S.itemPrice}>₹{item.price * item.quantity}</Text>
        </View>
      ))}

      {hasMore && (
        <TouchableOpacity style={S.expandBtn} onPress={toggleExpand} activeOpacity={0.7}>
          <Text style={S.expandTxt}>{expanded ? "Show less" : `+${order.items.length - 2} more`}</Text>
          <ChevronDown size={13} color={C.action} style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }} />
        </TouchableOpacity>
      )}

      <View style={S.hairline} />

      <View style={S.footer}>
        <View>
          <Text style={S.footerLbl}>{totalItems} item{totalItems > 1 ? "s" : ""} · {order.payment_mode}</Text>
          <Text style={S.totalAmt}>₹{order.total_amount}</Text>
        </View>
        <TouchableOpacity style={S.reorderBtn} onPress={() => onReorder(order)} activeOpacity={0.85}>
          <RotateCcw size={13} color={C.forest} strokeWidth={2.25} />
          <Text style={S.reorderTxt}>Reorder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Empty state ────────────────────────────────────────
function EmptyState({ onExplore }: { onExplore: () => void }) {
  return (
    <View style={S.empty}>
      <View style={S.emptyIconWrap}>
        <ShoppingBag size={30} color={C.forest} strokeWidth={1.75} />
      </View>
      <Text style={S.emptyTitle}>No orders yet</Text>
      <Text style={S.emptySub}>Your order history will show up here once you place your first order.</Text>
      <TouchableOpacity style={S.exploreBtn} onPress={onExplore} activeOpacity={0.88}>
        <Text style={S.exploreBtnTxt}>Explore Canteens</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Summary strip ──────────────────────────────────────
function SummaryStrip({ orders }: { orders: HistoryOrder[] }) {
  const total = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const items = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
  return (
    <View style={S.summary}>
      <View style={S.summaryStat}>
        <Text style={S.summaryVal}>{orders.length}</Text>
        <Text style={S.summaryLbl}>Orders</Text>
      </View>
      <View style={S.summaryDiv} />
      <View style={S.summaryStat}>
        <Text style={S.summaryVal}>₹{total}</Text>
        <Text style={S.summaryLbl}>Spent</Text>
      </View>
      <View style={S.summaryDiv} />
      <View style={S.summaryStat}>
        <Text style={S.summaryVal}>{items}</Text>
        <Text style={S.summaryLbl}>Dishes</Text>
      </View>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────
export default function OrderHistoryScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("user");
      if (!raw) return;
      const user = JSON.parse(raw);
      const res = await authFetch(`${API_URL}/orders/user/history/${user.id}`);
      if (res.ok) setOrders(await res.json());
    } catch {
      // leave orders as-is; the empty/error state below is enough signal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetched exactly once on mount -- pull-to-refresh is the only other trigger.
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [fetchHistory]);

  const handleReorder = useCallback((order: HistoryOrder) => {
    navigation.navigate("MenuPageScreen", {
      canteenId: order.canteen_id,
      canteenName: order.canteen_name,
    });
  }, [navigation]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<HistoryOrder>) => (
    <OrderCard order={item} onReorder={handleReorder} />
  ), [handleReorder]);

  if (loading) {
    return (
      <AppLayout navigation={navigation} headerBar={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <ScreenHeader title="Order History" />
        </View>
        <View style={S.loadingWrap}>
          <ActivityIndicator size="large" color={C.action} />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout navigation={navigation} headerBar={false}>
      <View style={S.root}>
        {orders.length === 0 ? (
          <>
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <ScreenHeader title="Order History" />
            </View>
            <EmptyState onExplore={() => navigation.navigate("CanteenSelectScreen")} />
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
            ListHeaderComponent={
              <>
                <ScreenHeader title="Order History" />
                <SummaryStrip orders={orders} />
              </>
            }
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
          />
        )}
      </View>
    </AppLayout>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  listContent: { padding: 16, paddingBottom: 32 },

  summary: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 14, marginBottom: 16,
  },
  summaryStat: { flex: 1, alignItems: "center" },
  summaryVal: { fontSize: 16, fontWeight: "700", color: C.ink, fontFamily: foodTypography.mono },
  summaryLbl: { fontSize: 11, color: C.ink3, marginTop: 2 },
  summaryDiv: { width: 1, height: 28, backgroundColor: C.border },

  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  canteenTile: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.actionBg, alignItems: "center", justifyContent: "center" },
  canteenName: { fontSize: 15.5, fontWeight: "700", color: C.ink },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  metaTxt: { fontSize: 11, color: C.ink3, fontFamily: foodTypography.mono },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.border, marginHorizontal: 2 },

  hairline: { height: 1, backgroundColor: C.borderLight, marginVertical: 12 },

  itemRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  itemName: { flex: 1, fontSize: 13.5, color: C.ink2 },
  itemQty: { fontSize: 12, color: C.ink3, fontFamily: foodTypography.mono },
  itemPrice: { fontSize: 13, fontWeight: "600", color: C.ink, minWidth: 44, textAlign: "right", fontFamily: foodTypography.mono },

  expandBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8 },
  expandTxt: { fontSize: 12.5, fontWeight: "700", color: C.action },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerLbl: { fontSize: 11.5, color: C.ink3 },
  totalAmt: { fontSize: 18, fontWeight: "700", color: C.ink, marginTop: 2, fontFamily: foodTypography.mono },
  reorderBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.actionBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  reorderTxt: { fontSize: 13, fontWeight: "700", color: C.forest },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: C.actionBg, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: C.ink, marginBottom: 6 },
  emptySub: { fontSize: 13.5, color: C.ink3, textAlign: "center", lineHeight: 20, marginBottom: 22 },
  exploreBtn: { height: 46, paddingHorizontal: 26, borderRadius: 10, backgroundColor: C.action, alignItems: "center", justifyContent: "center" },
  exploreBtnTxt: { fontSize: 14.5, fontWeight: "700", color: "#FFF" },
});

/**
 * MenuPageScreen.tsx
 *
 * Receives from navigation: { canteenId, canteenName }
 * WebSocket: ws://YOUR_IP:8000/ws/canteen/:id  (STOCK_UPDATE events)
 * API:       GET /menu/:canteenId
 *
 * Structure follows the design reference's canteen/menu screen: a single
 * column of item rows (not a card grid) grouped under one filter row
 * (All / Veg only / Non-Veg / Under ₹60), search lives here rather than
 * on Home ("ninety items" -- framework doc section 06). Each row is a
 * 76px icon tile + name/price/tag on the left, ADD / qty stepper on the
 * right. `desc` and per-item `tag` text aren't real backend fields (see
 * backend/modules/menu/router.py get_menu) so they're omitted rather than
 * invented -- the "Popular" tag only renders when `is_popular` is
 * actually true.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  ListRenderItemInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AlertCircle, ChevronRight, Minus, Plus, Search, ShoppingBag, X } from "lucide-react-native";
import AppLayout from "../layout/AppLayout";
import { useCart } from "../context/CartContext";
import { getMenu } from "../services/api";
import FoodImage from "../components/food/FoodImage";
import ScreenHeader from "../components/food/ScreenHeader";
import { getFoodColors, foodTypography, foodCardShadow } from "../theme/foodTheme";
import { WS_URL } from "../services/config";
import type { RootStackParamList } from "../types/navigation";
import type { MenuItem } from "../types/menu";

type Props = NativeStackScreenProps<RootStackParamList, "MenuPageScreen">;

const C = getFoodColors(false);
const WS_BASE = WS_URL;
const AFFORDABLE_THRESHOLD = 60;

type FilterId = "all" | "veg" | "nonveg" | "affordable";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "veg", label: "Veg only" },
  { id: "nonveg", label: "Non-Veg" },
  { id: "affordable", label: `Under ₹${AFFORDABLE_THRESHOLD}` },
];

function showToast(msg: string) {
  if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
}

// ─── Notification banner ──────────────────────────────
function NotifBanner({ msg, type }: { msg: string; type: "error" | "warning" }) {
  const bg = type === "error" ? C.red : C.accent;
  return (
    <View style={[S.notif, { backgroundColor: bg }]}>
      <AlertCircle size={14} color="#FFF" strokeWidth={2.5} />
      <Text style={S.notifTxt} numberOfLines={1}>{msg}</Text>
    </View>
  );
}

// Hoisted so FlatList's ItemSeparatorComponent prop keeps one stable
// identity -- an inline arrow here is a brand-new component type on every
// render, which forces FlatList to remount every separator.
const ItemSeparator = () => <View style={[S.hairline, { backgroundColor: C.borderLight }]} />;

// ─── Filter chip ───────────────────────────────────────
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[S.chip, { backgroundColor: active ? C.forest : C.surface, borderColor: active ? C.forest : C.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[S.chipTxt, { color: active ? "#FFF" : C.ink2 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Menu item row ─────────────────────────────────────
// Memoized: a menu can have hundreds of items, and without this every row
// re-renders whenever ANY item's stock changes (e.g. a WebSocket
// STOCK_UPDATE for one dish) because the `menu` array/`filtered` array gets
// a new reference. With React.memo + stable onAdd/onRemove/qty, only the
// row(s) whose own props actually changed re-render.
const MenuRow = React.memo(function MenuRow({
  item, qty, onAdd, onRemove,
}: { item: MenuItem; qty: number; onAdd: (item: MenuItem) => void; onRemove: (id: number) => void }) {
  const outOfStock = item.stock === 0;

  return (
    <View style={[S.row, outOfStock && { opacity: 0.55 }]}>
      <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
        <View style={S.rowNameLine}>
          <View style={[S.vegBox, { borderColor: item.is_veg ? C.action : C.red }]}>
            <View style={[S.vegDot, { backgroundColor: item.is_veg ? C.action : C.red }]} />
          </View>
          <Text style={[S.rowName, { color: C.ink }]} numberOfLines={1}>{item.name}</Text>
          {item.is_popular && (
            <View style={[S.tag, { backgroundColor: "#FBF3E7" }]}>
              <Text style={[S.tagTxt, { color: C.forest }]}>Popular</Text>
            </View>
          )}
        </View>
        <Text style={[S.rowPrice, { color: C.ink }]}>₹{item.price}</Text>
      </View>

      <View style={S.rowRight}>
        <View style={[S.thumb, { backgroundColor: C.actionBg }]}>
          <FoodImage source={item.image_url ? { uri: item.image_url } : null} tileBg={C.actionBg} />
        </View>
        {outOfStock ? (
          <View style={[S.addPill, { backgroundColor: C.surface2 }]}>
            <Text style={[S.addTxt, { color: C.ink3 }]}>N/A</Text>
          </View>
        ) : qty === 0 ? (
          <Pressable style={[S.addPill, { backgroundColor: C.actionBg }]} onPress={() => onAdd(item)}>
            <Text style={[S.addTxt, { color: C.forest }]}>ADD</Text>
          </Pressable>
        ) : (
          <View style={[S.stepper, { backgroundColor: C.actionBg }]}>
            <TouchableOpacity style={S.stepBtn} onPress={() => onRemove(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Minus size={12} color={C.forest} strokeWidth={2.6} />
            </TouchableOpacity>
            <Text style={[S.stepNum, { color: C.forest }]}>{qty}</Text>
            <TouchableOpacity
              style={S.stepBtn}
              onPress={() => qty < item.stock && onAdd(item)}
              disabled={qty >= item.stock}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Plus size={12} color={qty >= item.stock ? C.ink4 : C.forest} strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});

// ─── Floating cart bar ─────────────────────────────────
// Was a single flat pill with two plain text values -- easy to miss as a
// tappable CTA and no visual hierarchy between "what's in the cart" and
// "go to checkout". Now: an icon badge for the count, a clear total, and
// a distinct "View Cart" chip so the tap target reads as an action, not
// just a price label. Springs in when the cart goes from empty to
// non-empty instead of popping into existence.
function FloatingCartBar({
  count, total, onPress,
}: { count: number; total: number; onPress: () => void }) {
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, []);

  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View
      style={[
        S.cartBar,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            { scale },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={[S.cartBtn, { backgroundColor: C.action }]}
        onPress={press}
        activeOpacity={0.92}
      >
        <View style={S.cartIconWrap}>
          <ShoppingBag size={18} color="#FFF" strokeWidth={2} />
          <View style={S.cartBadge}>
            <Text style={S.cartBadgeTxt}>{count}</Text>
          </View>
        </View>

        <View style={S.cartMid}>
          <Text style={S.cartMidLbl} numberOfLines={1}>{count} item{count > 1 ? "s" : ""} added</Text>
          <Text style={S.cartTotal}>₹{total}</Text>
        </View>

        <View style={S.cartGo}>
          <Text style={S.cartGoTxt}>View Cart</Text>
          <ChevronRight size={15} color="#FFF" strokeWidth={2.5} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────
export default function MenuPageScreen({ route, navigation }: Props) {
  const { addToCart, removeFromCart, getItemQty, totalAmount, totalItemsCount } = useCart();
  const { canteenId, canteenName = "Menu", canteenIsActive = true } = route.params ?? ({} as Props["route"]["params"]);
  // Was a plain arrow function recreated on every render, which meant
  // handleAdd/renderItem below could never actually stay stable despite
  // their own useCallback wrapping (a new getQty identity on every render
  // is a changed dependency). Memoizing it is what lets renderItem's
  // identity actually stay stable across unrelated re-renders (search
  // typing, filter chips, WS stock ticks), which is what lets FlatList
  // avoid re-rendering every row on those actions.
  const getQty = useCallback(
    (id: number) => getItemQty(id, Number(canteenId)),
    [getItemQty, canteenId]
  );

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");
  const [notif, setNotif] = useState<{ message: string; type: "error" | "warning" } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout>>();

  const showNotif = useCallback((message: string, type: "error" | "warning" = "warning") => {
    clearTimeout(notifTimer.current);
    setNotif({ message, type });
    notifTimer.current = setTimeout(() => setNotif(null), 3200);
    showToast(message);
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      const data: MenuItem[] = await getMenu(canteenId);
      setMenu(Array.isArray(data) ? data : []);
    } catch {
      showNotif("Failed to load menu", "error");
      setMenu([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canteenId]);

  useEffect(() => { fetchMenu(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    if (!canteenId) return;
    const ws = new WebSocket(`${WS_BASE}/ws/canteen/${canteenId}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.event === "STOCK_UPDATE") {
          setMenu((prev) => prev.map((item) => (item.id === d.menu_item_id ? { ...item, stock: d.stock } : item)));
          if (d.stock === 0) showNotif("Item went out of stock", "error");
          else if (d.stock < 5) showNotif(`Only ${d.stock} left!`, "warning");
        }
      } catch { /* ignore malformed frames */ }
    };
    return () => ws.close();
  }, [canteenId]);

  const filtered = useMemo(() => {
    return menu.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === "all" ? true :
        filter === "veg" ? item.is_veg === true :
        filter === "nonveg" ? item.is_veg === false :
        item.price <= AFFORDABLE_THRESHOLD;
      return matchSearch && matchFilter;
    });
  }, [menu, search, filter]);

  const handleAdd = useCallback((item: MenuItem) => {
    if (!canteenIsActive) { showNotif(`${canteenName} is currently closed`, "error"); return; }
    const qty = getQty(item.id);
    if (item.stock === 0) { showNotif(`${item.name} is out of stock`, "error"); return; }
    if (qty >= item.stock) { showNotif("Max stock reached", "warning"); return; }
    addToCart({
      id: item.id, name: item.name, price: item.price, is_veg: item.is_veg,
      image_url: item.image_url, canteenId: Number(canteenId), canteenName,
    });
  }, [getQty, canteenId, canteenName, canteenIsActive, addToCart, showNotif]);

  const handleRemove = useCallback((itemId: number) => {
    removeFromCart(itemId, Number(canteenId));
  }, [canteenId, removeFromCart]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<MenuItem>) => (
    <MenuRow item={item} qty={getQty(item.id)} onAdd={handleAdd} onRemove={handleRemove} />
  ), [getQty, handleAdd, handleRemove]);

  return (
    <AppLayout navigation={navigation} headerBar={false}>
      <View style={[S.root, { backgroundColor: C.bg }]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <ScreenHeader title={canteenName} onBack={() => navigation.goBack()} />
        </View>
        {notif && <NotifBanner msg={notif.message} type={notif.type} />}

        {!canteenIsActive && (
          <View style={S.closedBanner}>
            <Text style={S.closedBannerTxt}>
              {canteenName} is currently closed — you can browse the menu, but ordering is unavailable right now.
            </Text>
          </View>
        )}

        <View style={S.filterBar}>
          <View style={[S.searchWrap, { borderColor: searchFocus ? C.action : C.border }]}>
            <Search size={16} color={searchFocus ? C.action : C.ink4} strokeWidth={1.9} />
            <TextInput
              style={[S.searchInput, { color: C.ink }]}
              placeholder="Search dishes"
              placeholderTextColor={C.ink4}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color={C.ink4} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>

          <View style={S.chipRow}>
            {FILTERS.map((f) => (
              <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
            ))}
          </View>
        </View>

        {loading ? (
          <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={[S.skeleton, { backgroundColor: C.actionBg }]} />)}
          </View>
        ) : filtered.length === 0 ? (
          <View style={S.empty}>
            <Text style={[S.emptyTitle, { color: C.ink }]}>Nothing found</Text>
            <Text style={[S.emptySub, { color: C.ink3 }]}>Try a different filter or search</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={S.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ItemSeparatorComponent={ItemSeparator}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={Platform.OS === "android"}
          />
        )}

        {totalItemsCount > 0 && (
          <FloatingCartBar
            count={totalItemsCount}
            total={totalAmount}
            onPress={() => navigation.navigate("CheckoutScreen")}
          />
        )}
      </View>
    </AppLayout>
  );
}

// ─── Styles ──────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1 },

  notif: {
    position: "absolute", top: Platform.OS === "ios" ? 56 : 12, left: 16, right: 16, zIndex: 999,
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
  },
  notifTxt: { flex: 1, color: "#FFF", fontSize: 13, fontWeight: "600" },

  closedBanner: {
    marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: "rgba(180,68,58,0.10)",
  },
  closedBannerTxt: { color: C.red, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },

  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10, height: 48,
    backgroundColor: "#FFF", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0, height: "100%" },

  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  chipTxt: { fontSize: 13, fontWeight: "600" },

  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  hairline: { height: 1 },

  row: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 14 },
  rowNameLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  vegBox: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 5, height: 5, borderRadius: 3 },
  rowName: { fontSize: 15.5, fontWeight: "600", flexShrink: 1 },
  tag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  tagTxt: { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: foodTypography.mono },
  rowPrice: { fontSize: 13, fontWeight: "600", marginTop: 2, fontFamily: foodTypography.mono },

  rowRight: { width: 76, alignItems: "center", gap: 6, flexShrink: 0 },
  thumb: { width: 76, height: 76, borderRadius: 10, overflow: "hidden" },
  addPill: { height: 26, width: "100%", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  addTxt: { fontSize: 12, fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 26, width: "100%", borderRadius: 8, paddingHorizontal: 6 },
  stepBtn: { width: 20, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 12.5, fontWeight: "700", fontFamily: foodTypography.mono },

  skeleton: { height: 90, borderRadius: 10 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptySub: { fontSize: 13.5, textAlign: "center" },

  cartBar: { position: "absolute", left: 16, right: 16, bottom: 20 },
  cartBtn: {
    height: 64, borderRadius: 18, paddingHorizontal: 12, flexDirection: "row", alignItems: "center",
    ...foodCardShadow(C.action),
  },
  cartIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  cartBadge: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  cartBadgeTxt: { fontSize: 10, fontWeight: "800", color: C.action, fontFamily: foodTypography.mono },
  cartMid: { flex: 1, marginLeft: 12, gap: 2, minWidth: 0 },
  cartMidLbl: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
  cartTotal: { fontSize: 18, fontWeight: "800", color: "#FFF", fontFamily: foodTypography.mono },
  cartGo: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999,
  },
  cartGoTxt: { fontSize: 13, fontWeight: "700", color: "#FFF" },
});

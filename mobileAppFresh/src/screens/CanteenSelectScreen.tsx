/**
 * CanteenSelectScreen — the Home experience's canteen-selection screen.
 *
 * Structure follows the approved design reference (framework doc sections
 * 06-07) closely:
 *   - Context row (college identity) + a single title block, not two
 *     stacked introductions.
 *   - "Your canteens" as a single-column list, open canteens first, no
 *     photography -- a 48px icon tile identifies the canteen instead.
 *   - No search bar and no filter chips on Home ("Search is not on Home...
 *     Sort is fixed, not user-controlled" -- framework doc section 06).
 *
 * What the reference also specifies but isn't built here, and why:
 *   - "Explore Nearby" (radius-based nearby colleges) needs geolocation +
 *     a nearby-college/radius backend that doesn't exist yet (CLAUDE.md
 *     section 6: don't invent that business logic in a UI task).
 *   - "Popular today" needs reliable cross-canteen popularity data; the
 *     backend's MenuItem has no populated is_popular signal to aggregate
 *     from, so showing it would mean fabricating the ranking.
 *   - Per-canteen crowd meter + hours + cuisine: Canteen only has
 *     id/name/location/college_id/is_active today (backend/models.py) --
 *     shown honestly means the OPEN/CLOSED pill (real is_active) renders,
 *     the rest doesn't. CrowdMeter (src/components/food/CrowdMeter.tsx)
 *     is built and ready for when that data lands.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronRight, Clock, Coffee, Flame, GraduationCap, Leaf, Soup, Utensils } from "lucide-react-native";
import {
  getCanteens,
  getCollege,
  getCachedCanteens,
  cacheCanteens,
  getCachedCollegeName,
  cacheCollege,
} from "../services/api";
import { getUser } from "../services/auth";
import FoodAssistant from "../components/FoodAssistant";
import AppLayout from "../layout/AppLayout";
import StatusPill from "../components/food/StatusPill";
import ScreenHeader from "../components/food/ScreenHeader";
import NotificationBell from "../components/food/NotificationBell";
import FoodImageCarousel from "../components/food/FoodImageCarousel";
import { getFoodColors, foodTypography } from "../theme/foodTheme";
import { formatTimeOfDay, minutesUntilClosing } from "../utils/canteenHours";
import type { MainTabParamList, RootStackParamList } from "../types/navigation";
import type { Canteen } from "../types/canteen";
import type { User } from "../types/user";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "CanteenSelectScreen">,
  NativeStackScreenProps<RootStackParamList>
>;

const C = getFoodColors(false);

const GLYPHS = [Utensils, Soup, Leaf, Coffee];
const getGlyph = (id: number) => GLYPHS[(id - 1) % GLYPHS.length];

// ─── Canteen list card ─────────────────────────────────
function CanteenCard({ item, onPress }: { item: Canteen; onPress: () => void }) {
  const dim = !item.is_active;
  const Glyph = getGlyph(item.id);
  const closingInMinutes = minutesUntilClosing(item.is_active, item.closes_at);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        S.card,
        { backgroundColor: dim ? "#FCFBF9" : C.surface, borderColor: dim ? "#EAE8E3" : C.border },
        pressed && { backgroundColor: C.bg },
      ]}
    >
      <View style={[S.cardTop, dim && S.cardTopDim]}>
        <View style={[S.tile, { backgroundColor: dim ? C.surface2 : C.actionBg, opacity: dim ? 0.45 : 1 }]}>
          <Glyph size={22} color={dim ? C.ink3 : C.forest} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={[S.name, { color: dim ? C.ink3 : C.ink }]} numberOfLines={1}>{item.name}</Text>
          {item.location ? (
            <Text style={[S.cuisine, { color: dim ? C.ink4 : C.ink3 }]} numberOfLines={1}>{item.location}</Text>
          ) : null}
        </View>
        <View style={[S.chevronWrap, { backgroundColor: C.surface2 }]}>
          <ChevronRight size={13} color={dim ? C.ink4 : C.ink3} strokeWidth={2.4} />
        </View>
      </View>

      <View style={[S.hairline, { backgroundColor: dim ? C.surface2 : C.borderLight }]} />

      <View style={[S.cardBottom, dim && S.cardBottomDim]}>
        <StatusPill open={item.is_active} />
        {dim && item.opens_at ? (
          <View style={S.hoursRow}>
            <Clock size={11} color={C.ink4} strokeWidth={2} />
            <Text style={[S.hoursTxt, { color: C.ink4 }]}>Opens {formatTimeOfDay(item.opens_at)}</Text>
          </View>
        ) : null}
        {!dim && closingInMinutes != null ? (
          <View style={S.closingSoonPill}>
            <Flame size={10} color={C.accent} strokeWidth={2.5} />
            <Text style={[S.closingSoonTxt, { color: C.accent }]}>Closing in {closingInMinutes} min</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ════════════════════════════════════════════════════════════════
export default function CanteenSelectScreen({ navigation }: Props) {
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [collegeId, setCollegeId] = useState<number | null>(null);
  const [collegeName, setCollegeName] = useState<string | null>(null);
  // Ticks once a minute purely to force CanteenCard's "Closing in N min"
  // pill to recompute against the current time -- no data refetch.
  const [, setClockTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setClockTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Single read of the already-authenticated session resolves identity
  // (userId) and tenant (collegeId) together. Canteen data must never be
  // fetched -- or rendered -- before collegeId is known: fetching without
  // it would return every college's canteens (see backend GET /canteens),
  // and briefly rendering that unscoped list is what caused a wrong-tenant
  // canteen to flash as "CLOSED" before the real, scoped list replaced it.
  useEffect(() => {
    getUser()
      .then((user: User | null) => {
        if (!user) return;
        setUserId(String(user.id));
        if (user.college_id != null) setCollegeId(user.college_id);
      })
      .catch(() => {});
  }, []);

  const fetchCanteens = useCallback(async (id: number) => {
    try {
      setError(false);
      const data = await getCanteens(id);
      setCanteens(Array.isArray(data) ? data : []);
      cacheCanteens(id, data);
    } catch (e) {
      console.error("Canteen fetch error:", e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Runs only once the tenant is resolved. Cached data for this exact
  // college paints instantly (loading state clears without waiting on the
  // network); the authoritative fetch always still runs to refresh it.
  // Canteens and the college name are independent lookups, so they run
  // concurrently rather than one after the other.
  useEffect(() => {
    if (collegeId == null) return;
    let cancelled = false;

    getCachedCanteens(collegeId).then((cached: Canteen[] | null) => {
      if (!cancelled && cached) {
        setCanteens(cached);
        setLoading(false);
      }
    });
    getCachedCollegeName(collegeId).then((name: string | null) => {
      if (!cancelled && name) setCollegeName(name);
    });

    fetchCanteens(collegeId);
    getCollege(collegeId)
      .then((college: { name: string }) => {
        if (cancelled) return;
        setCollegeName(college.name);
        cacheCollege(collegeId, college);
      })
      .catch(() => {
        // Display-only -- a failed name lookup falls back to the generic
        // label already shown, it must not block the canteen list.
      });

    return () => { cancelled = true; };
  }, [collegeId, fetchCanteens]);

  const onRefresh = useCallback(() => {
    if (collegeId == null) return;
    setRefreshing(true);
    fetchCanteens(collegeId);
  }, [fetchCanteens, collegeId]);

  // Open canteens first, closed pushed to the bottom -- fixed sort, no
  // user-facing sort control (framework doc section 06).
  const sorted = useMemo(
    () => [...canteens].sort((a, b) => Number(b.is_active) - Number(a.is_active)),
    [canteens]
  );
  const openCount = useMemo(() => canteens.filter((c) => c.is_active).length, [canteens]);

  const renderCard = useCallback(({ item }: ListRenderItemInfo<Canteen>) => (
    <CanteenCard
      item={item}
      onPress={() => navigation.navigate("MenuPageScreen", { canteenId: item.id, canteenName: item.name, canteenIsActive: item.is_active })}
    />
  ), [navigation]);

  return (
    <AppLayout navigation={navigation} headerBar={false}>
      <View style={[S.root, { backgroundColor: C.bg }]}>
        <FlatList
          data={sorted}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={
            <>
              {/* Context row */}
              <View style={S.contextRow}>
                <View style={[S.contextIcon, { backgroundColor: C.forest }]}>
                  <GraduationCap size={14} color={C.bg} strokeWidth={2} />
                </View>
                <Text style={[S.contextTxt, { color: C.ink }]} numberOfLines={1}>
                  {collegeName || "My College"}
                </Text>
                <View style={{ flex: 1 }} />
                <NotificationBell />
              </View>

              <ScreenHeader
                title="Select a canteen"
                subtitle={`${canteens.length} on campus`}
              />

              <View style={S.carouselWrap}>
                <FoodImageCarousel />
              </View>

              {!loading && canteens.length > 0 && (
                <View style={S.sectionHead}>
                  <Text style={[S.sectionTxt, { color: C.ink }]}>Your canteens</Text>
                  <Text style={[S.sectionCount, { color: C.ink3 }]}>{openCount} open</Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            loading ? (
              <View style={{ gap: 20 }}>
                {[0, 1, 2].map((i) => <View key={i} style={[S.skeleton, { backgroundColor: C.actionBg }]} />)}
              </View>
            ) : error ? (
              <View style={[S.errorCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[S.errorTitle, { color: C.ink }]}>No connection</Text>
                <Text style={[S.errorBody, { color: C.ink2 }]}>
                  We could not reach the campus network, so canteen hours may be out of date.
                </Text>
                <Pressable style={[S.retryBtn, { backgroundColor: C.action }]} onPress={() => collegeId != null && fetchCanteens(collegeId)}>
                  <Text style={S.retryTxt}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[S.emptyCard, { backgroundColor: C.actionBg }]}>
                <Text style={[S.emptyTxt, { color: C.forest }]}>
                  No canteens listed for your college yet.
                </Text>
              </View>
            )
          }
        />
      </View>

      <FoodAssistant canteens={canteens} isPeak={false} navigation={navigation} userId={userId} />
    </AppLayout>
  );
}

// ════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════
const S = StyleSheet.create({
  root: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  contextRow: { flexDirection: "row", alignItems: "center", gap: 10, height: 44 },
  contextIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  contextTxt: { fontSize: 14, fontWeight: "600", flexShrink: 1 },

  carouselWrap: { marginBottom: 20 },

  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  sectionTxt: { fontSize: 17, fontWeight: "700", letterSpacing: -0.15 },
  sectionCount: { fontSize: 12, fontFamily: foodTypography.mono },

  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12, marginBottom: 20 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  cardTopDim: { opacity: 0.75 },
  tile: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  name: { fontSize: 17, fontWeight: "600", lineHeight: 22, letterSpacing: -0.1 },
  cuisine: { fontSize: 13, lineHeight: 18 },
  chevronWrap: { width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  hairline: { height: 1 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardBottomDim: { opacity: 0.75 },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  hoursTxt: { fontSize: 11.5, fontWeight: "600", fontFamily: foodTypography.mono },
  closingSoonPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(217,154,74,0.14)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  closingSoonTxt: { fontSize: 11, fontWeight: "700" },

  skeleton: { height: 148, borderRadius: 14 },

  errorCard: { borderWidth: 1, borderRadius: 14, padding: 20, gap: 10 },
  errorTitle: { fontSize: 17, fontWeight: "700" },
  errorBody: { fontSize: 14, lineHeight: 21 },
  retryBtn: { height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 4 },
  retryTxt: { fontSize: 14.5, fontWeight: "600", color: "#FFF" },

  emptyCard: { borderRadius: 14, padding: 20 },
  emptyTxt: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});

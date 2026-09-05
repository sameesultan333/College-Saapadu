/**
 * ProfileScreen — the Profile tab's root screen.
 *
 * Reachable from the bottom tab bar (Home/Orders/Track/Wallet/Profile).
 * Profile info/logout previously only lived inside the Sidebar drawer
 * (still reachable from other, not-yet-redesigned screens' header avatar)
 * -- this is the primary, product-level home for it now.
 */
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ChevronRight, LogOut, Package, Truck, Wallet as WalletIcon } from "lucide-react-native";
import AppLayout from "../layout/AppLayout";
import ScreenHeader from "../components/food/ScreenHeader";
import { getUser, logout } from "../services/auth";
import { getCollege, getCachedCollegeName, cacheCollege } from "../services/api";
import { getFoodColors, foodTypography } from "../theme/foodTheme";
import type { MainTabParamList } from "../types/navigation";
import type { User } from "../types/user";

type Props = BottomTabScreenProps<MainTabParamList, "ProfileScreen">;

const C = getFoodColors(false);

export default function ProfileScreen({ navigation }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [collegeName, setCollegeName] = useState<string | null>(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  // Display-only, resolved once -- falls back silently if it fails. Looks
  // up only the user's own college_id (never the full platform list) so
  // this never loads another college's data just to show a name.
  useEffect(() => {
    const collegeId = user?.college_id;
    if (collegeId == null) return;

    getCachedCollegeName(collegeId).then((name) => {
      if (name) setCollegeName(name);
    });

    getCollege(collegeId)
      .then((college: { name: string }) => {
        setCollegeName(college.name);
        cacheCollege(collegeId, college);
      })
      .catch(() => {});
  }, [user?.college_id]);

  const handleLogout = async () => {
    await logout();
    // ProfileScreen lives nested inside MainTabs -- target the root stack
    // explicitly (see id="RootStack" on AppNavigator's Stack.Navigator),
    // same pattern as Sidebar's handleLogout.
    const target = navigation.getParent("RootStack" as never) || navigation;
    target.reset({ index: 0, routes: [{ name: "Login" as never }] });
  };

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "S";

  return (
    <AppLayout navigation={navigation} headerBar={false}>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Profile" />

        <View style={S.card}>
          <View style={S.avatar}>
            <Text style={S.avatarTxt}>{initial}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={S.name} numberOfLines={1}>{user?.name || "Student"}</Text>
            {collegeName ? <Text style={S.college} numberOfLines={1}>{collegeName}</Text> : null}
          </View>
        </View>

        <View style={S.section}>
          <DetailRow label="Institutional ID" value={user?.institutional_id} />
          <View style={S.divider} />
          <DetailRow label="Phone" value={user?.phone} />
          {user?.email ? (
            <>
              <View style={S.divider} />
              <DetailRow label="Email" value={user.email} />
            </>
          ) : null}
        </View>

        <View style={S.section}>
          <NavRow icon={Package} label="Order History" onPress={() => navigation.navigate("OrderHistoryScreen")} />
          <View style={S.divider} />
          <NavRow icon={Truck} label="Track Order" onPress={() => navigation.navigate("TrackOrderScreen")} />
          <View style={S.divider} />
          <NavRow icon={WalletIcon} label="Wallet" onPress={() => navigation.navigate("WalletScreen")} last />
        </View>

        <TouchableOpacity style={S.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <LogOut size={17} color={C.red} strokeWidth={2} />
          <Text style={S.logoutTxt}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </AppLayout>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={S.detailRow}>
      <Text style={S.detailLabel}>{label}</Text>
      <Text style={S.detailValue} numberOfLines={1}>{value || "—"}</Text>
    </View>
  );
}

function NavRow({ icon: Icon, label, onPress, last }: { icon: typeof Package; label: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[S.row, last && { paddingBottom: 16 }]} onPress={onPress} activeOpacity={0.7}>
      <View style={S.rowIconTile}>
        <Icon size={17} color={C.forest} strokeWidth={1.9} />
      </View>
      <Text style={S.rowTxt}>{label}</Text>
      <ChevronRight size={16} color={C.ink4} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.surface,
    borderRadius: 14, padding: 18, borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: C.action,
    alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontSize: 22, fontWeight: "700" },
  name: { fontSize: 17, fontWeight: "700", color: C.ink, marginBottom: 3 },
  college: { fontSize: 12.5, color: C.ink3 },

  section: {
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, marginBottom: 14,
  },

  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, gap: 12 },
  detailLabel: { fontSize: 13, color: C.ink3 },
  detailValue: { fontSize: 13.5, fontWeight: "600", color: C.ink, fontFamily: foodTypography.mono, flexShrink: 1, textAlign: "right" },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowIconTile: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.actionBg, alignItems: "center", justifyContent: "center" },
  rowTxt: { flex: 1, fontSize: 14.5, fontWeight: "600", color: C.ink },
  divider: { height: 1, backgroundColor: C.borderLight },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.red, borderRadius: 12, paddingVertical: 14,
  },
  logoutTxt: { color: C.red, fontSize: 15, fontWeight: "700" },
});

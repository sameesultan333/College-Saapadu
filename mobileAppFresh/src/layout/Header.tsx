/**
 * Header — shared app-chrome bar (back/logo, title, avatar → Sidebar).
 *
 * Redesigned to match the food-ordering screens' design system
 * (foodTheme: forest/action/cream/mono) instead of the old indigo/red
 * theme.js palette. Dropped two pieces of non-functional decoration that
 * were here before: the "peak hour" pill (an app-wide clock check with no
 * real signal behind it -- the per-canteen crowd meter is the real,
 * honest version of this idea) and the notification bell (hardcoded to
 * always show "2" with no backing notification system -- a fake badge is
 * worse than no badge).
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, UtensilsCrossed } from "lucide-react-native";
import { getUser } from "../services/auth";
import { getFoodColors, foodTypography } from "../theme/foodTheme";
import type { User } from "../types/user";

const C = getFoodColors(false);

interface HeaderProps {
  onProfileClick: () => void;
  title?: string;
  showBack?: boolean;
  navigation: { goBack: () => void };
}

export default function Header({ onProfileClick, title, showBack, navigation }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "S";

  return (
    <View style={[S.header, { paddingTop: insets.top + 8 }]}>
      <View style={S.row}>
        <View style={S.left}>
          {showBack ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={S.backCircle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <ChevronLeft size={20} color={C.ink} strokeWidth={2.25} />
            </TouchableOpacity>
          ) : (
            <View style={S.logoTile}>
              <UtensilsCrossed size={16} color={C.bg} strokeWidth={2} />
            </View>
          )}

          <Text style={S.title} numberOfLines={1}>{title || "College Saapadu"}</Text>
        </View>

        {user && (
          <TouchableOpacity onPress={onProfileClick} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={S.avatar}>
              <Text style={S.avatarTxt}>{initial}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  header: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    paddingBottom: 12,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  backCircle: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.surface2, alignItems: "center", justifyContent: "center",
  },
  logoTile: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: C.forest, alignItems: "center", justifyContent: "center",
  },
  title: {
    fontSize: 16, fontWeight: "700", color: C.ink, letterSpacing: -0.2, flexShrink: 1,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.action, alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontWeight: "700", fontSize: 13, fontFamily: foodTypography.mono },
});

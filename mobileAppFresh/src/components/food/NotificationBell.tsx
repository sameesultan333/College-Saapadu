/**
 * NotificationBell — Home's context row action. No unread dot: there is
 * no real notification feed behind this yet, and a badge that always
 * shows a fake count is worse than no badge (same reasoning as removing
 * the old Header's hardcoded "2"). Tapping it says so honestly rather
 * than opening a fabricated list.
 */
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Bell } from "lucide-react-native";
import { getFoodColors } from "../../theme/foodTheme";

const C = getFoodColors(false);

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={S.circle}
        onPress={() => setOpen((v) => !v)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Bell size={18} color={C.ink} strokeWidth={1.9} />
      </TouchableOpacity>
      {open && (
        <View style={S.popover}>
          <Text style={S.popoverTxt}>You're all caught up — no new notifications.</Text>
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  circle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: C.surface2 },
  popover: {
    position: "absolute", top: 40, right: 0, width: 200, backgroundColor: C.ink,
    borderRadius: 10, padding: 12, zIndex: 50,
  },
  popoverTxt: { color: C.bg, fontSize: 12.5, lineHeight: 17 },
});

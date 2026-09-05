/**
 * StatusPill — OPEN/CLOSED indicator (framework doc, section 07: "Both
 * carry an icon so status never depends on colour"). Backed by the real
 * `Canteen.is_active` field -- see backend/models.py.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Clock } from "lucide-react-native";
import { getFoodColors } from "../../theme/foodTheme";

export default function StatusPill({ open }: { open: boolean }) {
  const C = getFoodColors(false);
  return open ? (
    <View style={[S.pill, { backgroundColor: C.actionBg }]}>
      <View style={[S.dot, { backgroundColor: C.action }]} />
      <Text style={[S.txt, { color: C.forest }]}>OPEN</Text>
    </View>
  ) : (
    <View style={[S.pill, { backgroundColor: C.surface2 }]}>
      <Clock size={9} color={C.ink3} strokeWidth={3} />
      <Text style={[S.txt, { color: C.ink3 }]}>CLOSED</Text>
    </View>
  );
}

const S = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  txt: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.4 },
});

/**
 * ScreenHeader — the body-integrated title row used by every redesigned
 * screen instead of a separate fixed header bar (matches the design
 * reference: the title/context row is the first item that scrolls with
 * the content, there's no persistent chrome above it).
 *
 * Two shapes:
 *   - Root screen (no onBack): big 32px title, optional subtitle.
 *   - Sub-screen (onBack given): compact back-chevron + title row, for
 *     screens pushed on top of a tab (Menu, Checkout).
 */
import React, { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { getFoodColors, foodTypography } from "../../theme/foodTheme";

const C = getFoodColors(false);

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
}

export default function ScreenHeader({ title, subtitle, onBack, rightSlot }: ScreenHeaderProps) {
  if (onBack) {
    return (
      <View style={S.backRow}>
        <TouchableOpacity onPress={onBack} style={S.backCircle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={20} color={C.ink} strokeWidth={2.25} />
        </TouchableOpacity>
        <Text style={S.backTitle} numberOfLines={1}>{title}</Text>
        {rightSlot}
      </View>
    );
  }

  return (
    <View style={S.rootWrap}>
      <View style={S.titleRow}>
        <Text style={S.title}>{title}</Text>
        {rightSlot}
      </View>
      {subtitle ? <Text style={S.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const S = StyleSheet.create({
  backRow: { flexDirection: "row", alignItems: "center", gap: 12, height: 48, marginBottom: 4 },
  backCircle: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  backTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: C.ink },

  rootWrap: { gap: 4, paddingTop: 4, paddingBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 30, lineHeight: 35, fontWeight: "800", color: C.ink, letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: C.ink3, fontFamily: foodTypography.mono },
});

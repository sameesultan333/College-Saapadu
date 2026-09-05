/**
 * CrowdMeter — the design system's "signature component" (framework doc,
 * section 05). Four filled segments carry the meaning; color reinforces
 * it, so the level still reads in greyscale or high-contrast mode.
 *
 * Freshness is part of the component, not a footnote: a green dot + "Live"
 * under 2 min, "Updated N min ago" in muted mono up to 10 min, then the
 * meter desaturates to grey and reads "No live data" rather than lying.
 *
 * No canteen/crowd data source is wired up yet (Canteen only has
 * id/name/location/college_id/is_active today -- see backend/models.py).
 * This component is ready for when that lands; callers must not invent
 * a level/timestamp to pass in.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getFoodColors, foodTypography } from "../../theme/foodTheme";

export type CrowdLevel = 1 | 2 | 3 | 4;

const LEVEL_LABEL: Record<CrowdLevel, string> = {
  1: "Quiet",
  2: "Moderate",
  3: "Busy",
  4: "Very Busy",
};

interface CrowdMeterProps {
  /** Minutes since the crowd reading was taken. Omit/undefined if unknown. */
  updatedMinutesAgo?: number;
  level?: CrowdLevel;
  queueText?: string;
  /** 11x6 segments beside the label (Home card) vs the full detail form. */
  compact?: boolean;
}

export default function CrowdMeter({ updatedMinutesAgo, level, queueText, compact }: CrowdMeterProps) {
  const C = getFoodColors(false);
  const stale = updatedMinutesAgo == null || updatedMinutesAgo > 10;
  const isLive = updatedMinutesAgo != null && updatedMinutesAgo < 2;

  const levelColor = stale || !level
    ? C.ink4
    : level >= 4 ? C.red : level === 3 ? C.accent : C.action;

  const filled = stale || !level ? 1 : level;
  const segW = compact ? 11 : undefined;
  const segH = compact ? 6 : 7;
  const gap = compact ? 2.5 : 3;

  const label = stale || !level ? "No live data" : LEVEL_LABEL[level];

  return (
    <View style={S.wrap}>
      <View style={S.row}>
        <View style={[S.segRow, { gap }]}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: segW ?? undefined,
                flex: segW ? undefined : 1,
                height: segH,
                borderRadius: 6,
                backgroundColor: i < filled ? levelColor : C.border,
              }}
            />
          ))}
        </View>
        <Text style={[S.label, { color: stale ? C.ink4 : levelColor, fontWeight: stale ? "500" : "600" }]}>
          {label}
        </Text>
        {!compact && (
          isLive ? (
            <View style={S.liveRow}>
              <View style={[S.liveDot, { backgroundColor: C.action }]} />
              <Text style={[S.liveTxt, { color: C.action }]}>LIVE</Text>
            </View>
          ) : !stale && updatedMinutesAgo != null ? (
            <Text style={[S.updatedTxt, { color: C.ink4 }]}>Updated {updatedMinutesAgo} min ago</Text>
          ) : null
        )}
      </View>
      {!compact && queueText && !stale ? (
        <Text style={[S.queueTxt, { color: C.ink3 }]}>{queueText}</Text>
      ) : null}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  segRow: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 13, flexShrink: 0 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: "auto" },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTxt: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.6, fontFamily: foodTypography.mono },
  updatedTxt: { fontSize: 11, marginLeft: "auto", fontFamily: foodTypography.mono },
  queueTxt: { fontSize: 12, fontFamily: foodTypography.mono },
});

/**
 * FoodImageCarousel — the Home header's auto-sliding food photo band.
 *
 * 10 slides, sourced from src/assets/food's local image registry by key.
 * Until real photos are dropped in there (see src/assets/food/index.ts),
 * every slide falls back to FoodImage's sage-tile + icon placeholder --
 * the carousel itself is fully functional today; adding a photo later is
 * just registering it in localFoodImages, no component change needed.
 */
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from "react-native";
import FoodImage from "./FoodImage";
import { getFoodColors } from "../../theme/foodTheme";
import type { LocalFoodImageKey } from "../../assets/food";

const C = getFoodColors(false);
const { width: SCREEN_W } = Dimensions.get("window");
const SLIDE_W = SCREEN_W - 32; // matches the screen's 16px side gutters
const AUTO_ADVANCE_MS = 3500;

// The 10 slide slots. Keys map to src/assets/food's registry -- add the
// matching `require(...)` there and the real photo replaces the
// placeholder automatically, no change needed here.
const SLIDES: LocalFoodImageKey[] = [
  "idly", "dosa", "vada", "samosa", "biryani",
  "meals", "parotta", "coffee", "juice", "sweet",
];

export default function FoodImageCarousel() {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % SLIDES.length;
      scrollRef.current?.scrollTo({ x: next * SLIDE_W, animated: true });
      indexRef.current = next;
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, []);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
    indexRef.current = i;
    setIndex(i);
  };

  return (
    <View style={S.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        style={{ borderRadius: 14 }}
      >
        {SLIDES.map((key, i) => (
          <View key={key + i} style={S.slide}>
            <FoodImage source={{ local: key }} tileBg={C.actionBg} />
          </View>
        ))}
      </ScrollView>

      <View style={S.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[S.dot, i === index && S.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { gap: 10 },
  slide: { width: SLIDE_W, height: 170, borderRadius: 14, overflow: "hidden" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.border },
  dotActive: { width: 14, backgroundColor: C.action },
});

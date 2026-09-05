/**
 * FoodImage — single image abstraction for the food-ordering screens.
 *
 * Supports three sources without the caller needing to know which one it
 * got, so the UI never has to change when the source changes later
 * (local asset today, S3/CDN url tomorrow):
 *
 *   <FoodImage source={{ local: "idly" }} .../>       -- src/assets/food
 *   <FoodImage source={{ uri: item.image_url }} .../>  -- remote/S3/CDN
 *   <FoodImage source={null} .../>                     -- no image yet
 *
 * When no image is available (source is null/undefined, or a remote load
 * fails), it renders a sage-tinted tile with a glyph icon -- per the
 * design reference, "every image has a sage tinted fallback with the
 * cuisine glyph, so a failed load never leaves a hole" (framework doc
 * section 09). No emoji anywhere (framework doc section 08's explicit
 * rule) -- this used to fall back to an emoji character; fixed to use a
 * lucide icon instead. A brief loading tint shows for remote images
 * while they fetch.
 */
import React, { useState } from "react";
import { Image, StyleSheet, View, ViewStyle } from "react-native";
import { Utensils } from "lucide-react-native";
import { localFoodImages, LocalFoodImageKey } from "../../assets/food";
import { getFoodColors } from "../../theme/foodTheme";

export type FoodImageSource = { local: LocalFoodImageKey } | { uri: string } | null | undefined;

interface FoodImageProps {
  source: FoodImageSource;
  style?: ViewStyle;
  tileBg?: string;
}

const C = getFoodColors(false);

export default function FoodImage({ source, style, tileBg }: FoodImageProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isRemote = !!source && "uri" in source && !!source.uri;
  const isLocal = !!source && "local" in source && !!localFoodImages[source.local];

  if (isRemote && !remoteFailed) {
    return (
      <View style={[S.wrap, style]}>
        <Image
          source={{ uri: (source as { uri: string }).uri }}
          style={S.img}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
          onError={() => setRemoteFailed(true)}
        />
        {!loaded && <View style={[S.loadingTint, { backgroundColor: tileBg || C.actionBg }]} />}
      </View>
    );
  }

  if (isLocal) {
    return (
      <View style={[S.wrap, style]}>
        <Image source={localFoodImages[(source as { local: LocalFoodImageKey }).local]} style={S.img} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={[S.wrap, S.fallback, { backgroundColor: tileBg || C.actionBg }, style]}>
      <Utensils size={22} color={C.forest} strokeWidth={1.75} />
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { width: "100%", height: "100%", overflow: "hidden" },
  img: { width: "100%", height: "100%" },
  loadingTint: { ...StyleSheet.absoluteFillObject },
  fallback: { alignItems: "center", justifyContent: "center" },
});

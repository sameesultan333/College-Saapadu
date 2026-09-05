import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Wallet as WalletIcon } from "lucide-react-native";
import AppLayout from "../layout/AppLayout";
import ScreenHeader from "../components/food/ScreenHeader";
import { getWalletBalance } from "../services/api";
import { getFoodColors, foodTypography } from "../theme/foodTheme";

const C = getFoodColors(false);

export default function WalletScreen({ navigation }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await getWalletBalance();
        if (!cancelled) setBalance(value);
      } catch {
        if (!cancelled) setError("Could not load your balance. Pull to refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppLayout navigation={navigation} headerBar={false}>
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Wallet" />

        <View style={styles.card}>
          <View style={styles.iconTile}>
            <WalletIcon size={20} color={C.forest} strokeWidth={1.75} />
          </View>
          <Text style={styles.label}>Available Balance</Text>
          {loading ? (
            <ActivityIndicator color={C.action} style={{ marginVertical: 10 }} />
          ) : (
            <Text style={styles.amount}>₹{balance ?? 0}</Text>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>Adding money isn't available yet</Text>
          <Text style={styles.noteBody}>
            This is your real, live balance -- it updates automatically after every order.
            Wallet top-up will be added once a payment gateway is set up. For now, ask at
            the canteen counter if you need balance added.
          </Text>
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14,
    padding: 22, alignItems: "center", marginBottom: 16,
  },
  iconTile: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.actionBg, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  label: { fontSize: 13, color: C.ink3, marginBottom: 4 },
  amount: { fontSize: 38, fontWeight: "800", color: C.ink, fontFamily: foodTypography.mono },
  error: { fontSize: 12, color: C.red, marginTop: 6 },

  noteBox: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 18, gap: 6 },
  noteTitle: { fontSize: 14.5, fontWeight: "700", color: C.ink },
  noteBody: { fontSize: 13, lineHeight: 19, color: C.ink3 },
});

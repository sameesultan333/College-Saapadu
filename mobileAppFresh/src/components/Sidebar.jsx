import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Alert
} from "react-native";

import {
  UtensilsCrossed,
  Package,
  History,
  Wallet,
  LogOut,
  X
} from "lucide-react-native";

import { getUser, logout } from "../services/auth";
import { theme } from "../theme/theme";

const DRAWER_WIDTH = 320;

export default function Sidebar({ visible, onClose, navigation }) {

  const [user, setUser] = useState(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: false
    }).start();
  }, [visible]);

  const go = (screen) => {
    onClose();
    navigation.navigate(screen);
  };

  const comingSoon = (name) => {
    onClose();
    Alert.alert(name, "This feature will be available soon.");
  };

  const handleLogout = async () => {
    await logout();
    // Sidebar is reachable from screens nested inside MainTabs (tab
    // navigator) as well as screens directly on the root stack -- replace()
    // only affects the navigator it's called on, so target the root stack
    // explicitly (see id="RootStack" on AppNavigator's Stack.Navigator) and
    // fall back to the local navigator when this already IS the root.
    const target = navigation.getParent("RootStack") || navigation;
    target.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  return (
    <View
      pointerEvents={visible ? "auto" : "none"}
      style={styles.container}
    >

      {/* Backdrop */}

      {visible && (
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* Drawer */}

      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX }] }
        ]}
      >

        {/* Header */}

        <View style={styles.header}>
          <Text style={styles.title}>Menu</Text>

          <TouchableOpacity onPress={onClose}>
            <X size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Profile */}

        <View style={styles.profile}>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || "S"}
            </Text>
          </View>

          <View>
            <Text style={styles.name}>
              {user?.name || "User"}
            </Text>

            <Text style={styles.id}>
              {user?.institutional_id || ""}
            </Text>
            {user?.role && (
              <Text style={styles.role}>
                {user.role.toUpperCase()}
              </Text>
            )}
          </View>

        </View>

        <View style={styles.divider} />

        {/* Browse Canteens */}

        <TouchableOpacity
          style={styles.item}
          onPress={() => go("CanteenSelectScreen")}
        >
          <UtensilsCrossed size={20} color={theme.colors.textTertiary} />
          <Text style={styles.itemText}>Browse Canteens</Text>
        </TouchableOpacity>

        {/* Track Orders */}

        <TouchableOpacity
          style={styles.item}
          onPress={() => go("TrackOrderScreen")}
        >
          <Package size={20} color={theme.colors.textTertiary} />
          <Text style={styles.itemText}>My Orders</Text>
        </TouchableOpacity>

        {/* Order History (placeholder) */}

        <TouchableOpacity
          style={styles.item}
          onPress={() => go("OrderHistoryScreen")}
        >
          <History size={20} color={theme.colors.textTertiary} />
          <Text style={styles.itemText}>Order History</Text>
        </TouchableOpacity>

        {/* Wallet (placeholder) */}

        <TouchableOpacity
          style={styles.item}
          onPress={() => go("WalletScreen")}
        >
          <Wallet size={20} color={theme.colors.textTertiary} />
          <Text style={styles.itemText}>Wallet</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Logout */}

        <TouchableOpacity
          style={styles.logout}
          onPress={handleLogout}
        >
          <LogOut size={18} color={theme.colors.white} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({

 // Sidebar.jsx — styles.container
container: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9999,
  elevation: 9999,
  flexDirection: "row"
},
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)"
  },

  drawer: {
    position: "absolute",
    right: 0,
    width: DRAWER_WIDTH,
    height: "100%",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    ...theme.shadows.drawer,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xl
  },

  title: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text
  },

  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },

  avatarText: {
    color: theme.colors.white,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.xl
  },

  name: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text
  },

  id: {
    fontSize: theme.typography.sizes.sm2,
    color: theme.colors.textMuted
  },
  role: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    marginTop: 2,
    letterSpacing: 0.5
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14
  },

  itemText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textSecondary
  },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.danger,
    padding: 14,
    borderRadius: theme.borderRadius.lg
  },

  logoutText: {
    color: theme.colors.white,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.lg
  }

});

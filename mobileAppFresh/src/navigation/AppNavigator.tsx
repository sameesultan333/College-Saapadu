import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Package, Truck, Wallet, User } from "lucide-react-native";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import CanteenSelectScreen from "../screens/CanteenSelectScreen";
import MenuPageScreen from "../screens/MenuPageScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import OrderSuccessScreen from "../screens/OrderSuccessScreen";
import TrackOrderScreen from "../screens/TrackOrderScreen";
import OrderHistoryScreen from "../screens/OrderHistoryScreen";
import WalletScreen from "../screens/WalletScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { getFoodColors } from "../theme/foodTheme";
import type { MainTabParamList, RootStackParamList } from "../types/navigation";

const C = getFoodColors(false);

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * MainTabs — the persistent bottom tab bar (Home/Orders/Wallet/Profile),
 * matching the approved design reference. Canteen selection lives on Home,
 * not as its own tab (see CanteenSelectScreen.tsx). Route names match the
 * screen names used elsewhere in the app (Sidebar, FoodAssistant, ...) so
 * existing navigation.navigate("CanteenSelectScreen")-style calls keep
 * working unchanged now that these screens live inside a nested navigator.
 * Each tab screen renders its own AppLayout (Header) internally, so
 * headers stay off here.
 */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.action,
        tabBarInactiveTintColor: C.ink3,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.border },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "700" },
      }}
    >
      <Tab.Screen
        name="CanteenSelectScreen"
        component={CanteenSelectScreen}
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="OrderHistoryScreen"
        component={OrderHistoryScreen}
        options={{ title: "Orders", tabBarIcon: ({ color, size }) => <Package color={color} size={size} /> }}
      />
      <Tab.Screen
        name="TrackOrderScreen"
        component={TrackOrderScreen}
        options={{ title: "Track", tabBarIcon: ({ color, size }) => <Truck color={color} size={size} /> }}
      />
      <Tab.Screen
        name="WalletScreen"
        component={WalletScreen}
        options={{ title: "Wallet", tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }}
      />
      <Tab.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="RegisterScreen" component={RegisterScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="MenuPageScreen" component={MenuPageScreen} />
        <Stack.Screen name="CheckoutScreen" component={CheckoutScreen} />
        <Stack.Screen name="OrderSuccessScreen" component={OrderSuccessScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import React, { ReactNode, useState } from "react";
import { StatusBar, View } from "react-native";
import Header from "./Header";
import Sidebar from "../components/Sidebar";
import { getFoodColors } from "../theme/foodTheme";

const C = getFoodColors(false);

interface AppLayoutProps {
  children: ReactNode;
  navigation: any;
  title?: string;
  showBack?: boolean;
  /**
   * false = no separate header bar; the screen renders its own title/back
   * row as part of its scrollable body (CanteenSelectScreen, MenuPageScreen,
   * CheckoutScreen, OrderHistoryScreen, WalletScreen, ProfileScreen all do
   * this now, matching the design reference -- there's no fixed chrome bar
   * in that design, the context/title row just scrolls with the content).
   * Defaults to true so screens not yet redesigned (TrackOrderScreen,
   * OrderSuccessScreen) keep working unchanged.
   */
  headerBar?: boolean;
}

export default function AppLayout({ children, navigation, title, showBack, headerBar = true }: AppLayoutProps) {
  const [sidebar, setSidebar] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {headerBar && (
        <View style={{ zIndex: 20 }}>
          <Header
            onProfileClick={() => setSidebar(true)}
            title={title}
            showBack={showBack}
            navigation={navigation}
          />
        </View>
      )}

      <View style={{ flex: 1, overflow: "hidden" }}>
        {children}
      </View>

      {headerBar && (
        <Sidebar visible={sidebar} onClose={() => setSidebar(false)} navigation={navigation} />
      )}
    </View>
  );
}

import { Tabs } from "expo-router";
import { House, Inbox, Radio, Shield, Swords } from "lucide-react-native";
import { useModeAccent } from "@/lib/theme";
import { BottomNavigation } from "@/components/nav/BottomNavigation";
import { cpcHex } from "@/lib/design/cpc-native";

export const unstable_settings = {
  initialRouteName: "home",
};

/**
 * Mode Club — Accueil | Matchmaking (LIVE recruit) | Match (feuille) | Recrutement.
 * Club identity hors tab bar (`href: null`).
 */
export default function ClubTabsLayout() {
  const accent = useModeAccent();

  return (
    <Tabs
      initialRouteName="home"
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: cpcHex.disabled,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Accueil", tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: "Matchmaking", tabBarIcon: ({ color, size }) => <Radio color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="match"
        options={{ title: "Match", tabBarIcon: ({ color, size }) => <Swords color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="candidatures"
        options={{ title: "Recrutement", tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="effectif"
        options={{
          href: null,
          tabBarItemStyle: { display: "none" },
          title: "Club",
          tabBarIcon: ({ color, size }) => <Shield color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

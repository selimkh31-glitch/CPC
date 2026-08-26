import { Tabs } from "expo-router";
import { House, Inbox, Radio, Shield, Swords } from "lucide-react-native";
import { useModeAccent } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: "home",
};

const TAB_BAR_STYLE = {
  backgroundColor: "#08090b",
  borderTopColor: "rgba(255,255,255,0.06)",
  borderTopWidth: 0.5,
  height: 56,
  paddingBottom: 6,
  paddingTop: 6,
} as const;

/**
 * Mode Club — 3 onglets : Accueil | Matchmaking | Recrutement.
 * index.tsx reste la feuille (ex-LIVE) pour les deep links.
 * Club / match hors tab bar (`href: null`).
 */
export default function ClubTabsLayout() {
  const accent = useModeAccent();

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: "#666c74",
        tabBarStyle: TAB_BAR_STYLE,
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
        name="candidatures"
        options={{ title: "Recrutement", tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="effectif"
        options={{ href: null, title: "Club", tabBarIcon: ({ color, size }) => <Shield color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="match"
        options={{ href: null, title: "Match", tabBarIcon: ({ color, size }) => <Swords color={color} size={size} /> }}
      />
    </Tabs>
  );
}

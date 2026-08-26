import { Tabs } from "expo-router";
import { Inbox, Radio, Shield, Swords } from "lucide-react-native";
import { useModeAccent } from "@/lib/theme";

const TAB_BAR_STYLE = {
  backgroundColor: "#08090b",
  borderTopColor: "rgba(255,255,255,0.06)",
  borderTopWidth: 0.5,
  height: 56,
  paddingBottom: 6,
  paddingTop: 6,
} as const;

/**
 * Mode Club — 2 onglets : LIVE | Recrutement.
 * Club (identité / effectif) reste joignable plus tard depuis le menu (`href: null`).
 * match (feuille) reste un fichier pour deep link `/match`, hors tab bar.
 */
export default function ClubTabsLayout() {
  const accent = useModeAccent();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: "#666c74",
        tabBarStyle: TAB_BAR_STYLE,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "LIVE", tabBarIcon: ({ color, size }) => <Radio color={color} size={size} /> }}
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

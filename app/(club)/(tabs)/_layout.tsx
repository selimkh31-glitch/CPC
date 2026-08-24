import { Tabs } from "expo-router";
import { Inbox, Radio, Shield, Swords } from "lucide-react-native";

const TAB_BAR_STYLE = {
  backgroundColor: "#0f1114",
  borderTopColor: "#24272c",
  borderTopWidth: 1,
  height: 64,
  paddingBottom: 10,
  paddingTop: 8,
} as const;

/**
 * Mode Club — 3 onglets : LIVE | Recrutement | Club.
 * match (feuille de match) reste un fichier pour deep link `/match`, hors tab bar.
 */
export default function ClubTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#39ff8a",
        tabBarInactiveTintColor: "#666c74",
        tabBarStyle: TAB_BAR_STYLE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
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
        options={{ title: "Club", tabBarIcon: ({ color, size }) => <Shield color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="match"
        options={{ href: null, title: "Match", tabBarIcon: ({ color, size }) => <Swords color={color} size={size} /> }}
      />
    </Tabs>
  );
}

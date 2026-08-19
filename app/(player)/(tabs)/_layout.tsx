import { Tabs } from "expo-router";
import { Radio, Trophy, User, Users } from "lucide-react-native";

/**
 * Navigation Mode Joueur (Foundation #1 — déplacé depuis app/(tabs)/_layout.tsx,
 * contenu inchangé) : LIVE | CLUBS | LIGUES | PROFIL. LIVE est l'écran d'accueil.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#39ff8a",
        tabBarInactiveTintColor: "#666c74",
        tabBarStyle: {
          backgroundColor: "#0f1114",
          borderTopColor: "#24272c",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Live", tabBarIcon: ({ color, size }) => <Radio color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="clubs"
        options={{ title: "Clubs", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="leagues"
        options={{ title: "Ligues", tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tabs>
  );
}

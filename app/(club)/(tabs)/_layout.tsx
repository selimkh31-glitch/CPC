import { Tabs } from "expo-router";
import { Inbox, Swords, Users } from "lucide-react-native";

/**
 * Navigation Mode Club (Foundation #2.2 — fusion Dashboard+Composition) —
 * bottom tabs persistantes, symétrique de app/(player)/(tabs)/_layout.tsx.
 * 3 tabs : MATCH (préparation -> Match Center, un seul contexte continu),
 * EFFECTIF (membres + départs, activité permanente du club), CANDIDATURES.
 * Le recrutement (player-search) reste un push depuis Match, pas un tab
 * séparé — fonctionnalité existante réutilisée telle quelle.
 */
export default function ClubTabsLayout() {
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
        name="match"
        options={{ title: "Match", tabBarIcon: ({ color, size }) => <Swords color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="effectif"
        options={{ title: "Effectif", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="candidatures"
        options={{ title: "Candidatures", tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} /> }}
      />
    </Tabs>
  );
}

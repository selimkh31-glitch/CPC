import { Tabs } from "expo-router";
import { Bell, House, Radio, User, Users } from "lucide-react-native";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useUnreadNotificationCount } from "@/lib/hooks/useNotifications";
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
 * Mode Joueur — 3 onglets : Accueil | Matchmaking | Activité.
 * index.tsx reste Matchmaking (ex-LIVE) pour les deep links.
 * Profil / clubs hors tab bar (`href: null`).
 */
export default function TabsLayout() {
  const { session } = useAuth();
  const unread = useUnreadNotificationCount(session?.user.id ?? null);
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
        name="activity"
        options={{
          title: "Activité",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: accent, color: "#08090b" },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, title: "Profil", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
      <Tabs.Screen name="clubs" options={{ href: null, title: "Clubs", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
    </Tabs>
  );
}

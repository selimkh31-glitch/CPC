import { Tabs } from "expo-router";
import { Bell, House, Radio, User, Users } from "lucide-react-native";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useUnreadNotificationCount } from "@/lib/hooks/useNotifications";
import { useModeAccent } from "@/lib/theme";
import { BottomNavigation } from "@/components/nav/BottomNavigation";
import { cpcHex } from "@/lib/design/cpc-native";

export const unstable_settings = {
  initialRouteName: "home",
};

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
        name="activity"
        options={{
          title: "Activité",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: accent, color: cpcHex.accentForeground },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          tabBarItemStyle: { display: "none" },
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          href: null,
          tabBarItemStyle: { display: "none" },
          title: "Clubs",
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

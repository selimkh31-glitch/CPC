import { Tabs } from "expo-router";
import { Bell, Radio, User, Users } from "lucide-react-native";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useUnreadNotificationCount } from "@/lib/hooks/useNotifications";

const TAB_BAR_STYLE = {
  backgroundColor: "#0f1114",
  borderTopColor: "#24272c",
  borderTopWidth: 1,
  height: 64,
  paddingBottom: 10,
  paddingTop: 8,
} as const;

/**
 * Mode Joueur — 2 onglets : LIVE | Activité.
 * Profil est joignable depuis le menu (`href: null`), plus un onglet bas.
 * clubs reste un fichier (deep link) hors tab bar (`href: null`).
 * Ligues n'est PAS un onglet : uniquement le stack partagé `app/leagues.tsx`
 * (`/leagues`) pour que Club → Classement et Profil → Classement partagent
 * la même pile (retour header), sans collision de route avec un Redirect.
 */
export default function TabsLayout() {
  const { session } = useAuth();
  const unread = useUnreadNotificationCount(session?.user.id ?? null);

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
        name="activity"
        options={{
          title: "Activité",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: "#39ff8a", color: "#08090b" },
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

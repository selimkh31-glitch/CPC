import { Tabs } from "expo-router";
import { Bell, Radio, User, Users } from "lucide-react-native";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useUnreadNotificationCount } from "@/lib/hooks/useNotifications";
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

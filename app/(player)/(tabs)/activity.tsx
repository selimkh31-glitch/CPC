import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MyApplicationsList } from "@/components/player/MyApplicationsList";
import { MyInvitationsList } from "@/components/player/MyInvitationsList";
import { NotificationsList } from "@/components/player/NotificationsList";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyInvitations } from "@/lib/hooks/useInvitations";
import { useUnreadNotificationCount } from "@/lib/hooks/useNotifications";

type ActivitySegment = "applications" | "invitations" | "notifications";

/**
 * Activité — candidatures + invitations + notifications. Destinations existantes.
 * Pas de nouveaux types de notifs.
 */
export default function ActivityTab() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [segment, setSegment] = useState<ActivitySegment>("notifications");
  const { data: invitations } = useMyInvitations(userId);
  const unread = useUnreadNotificationCount(userId);
  const pendingInvitations = invitations?.filter((i) => i.status === "PENDING").length ?? 0;

  const segments: { key: ActivitySegment; label: string }[] = [
    { key: "applications", label: "Postulé" },
    { key: "invitations", label: pendingInvitations > 0 ? `Invitations (${pendingInvitations})` : "Invitations" },
    { key: "notifications", label: unread > 0 ? `Notifs (${unread})` : "Notifications" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={[]}>
      <View className="px-5 pt-2 pb-4">
        <Text className="mb-1 font-display text-[34px] leading-10 text-fg">Activité</Text>
        <Text className="mb-5 text-[11px] tracking-wide text-fg-subtle">Tes retours. Touche une ligne pour ouvrir.</Text>
        <View className="flex-row rounded-full border border-white/10 bg-white/[0.03] p-0.5">
          {segments.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setSegment(s.key)}
              className={`min-h-[40px] flex-1 justify-center rounded-full px-2 py-2 ${segment === s.key ? "bg-accent" : ""}`}
              accessibilityRole="button"
              accessibilityState={{ selected: segment === s.key }}
            >
              <Text
                numberOfLines={1}
                className={`text-center text-[11px] font-semibold ${segment === s.key ? "text-bg" : "text-fg-muted"}`}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        {segment === "applications" && <MyApplicationsList />}
        {segment === "invitations" && <MyInvitationsList />}
        {segment === "notifications" && <NotificationsList />}
      </ScrollView>
    </SafeAreaView>
  );
}

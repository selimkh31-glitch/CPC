import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/providers/AuthProvider";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/hooks/useNotifications";
import { notificationHref, notificationTitle } from "@/lib/safety";
import { timeAgo } from "@/lib/utils";
import type { NotificationRow } from "@/lib/types";

/** Liste des notifications in-app — extraite de app/notifications.tsx pour l'onglet Activité. */
export function NotificationsList() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { data, isLoading, isError, refetch } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAll = useMarkAllNotificationsRead(userId);
  const unread = (data ?? []).filter((n) => !n.read_at).length;

  const open = (item: NotificationRow) => {
    if (!item.read_at) markRead.mutate(item.id);
    router.push(notificationHref(item.type, item.data) as any);
  };

  if (isLoading) {
    return (
      <View className="gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Impossible de charger tes notifications." onRetry={refetch} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Aucune notification pour l'instant."
        subtitle="Candidatures, invitations, messages et réponses apparaîtront ici."
      />
    );
  }

  return (
    <View className="gap-2">
      {unread > 0 && (
        <View className="mb-1 flex-row justify-end">
          <Button variant="ghost" size="sm" loading={markAll.isPending} onPress={() => markAll.mutate()}>
            Tout lu
          </Button>
        </View>
      )}
      {data.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => open(item)}
          className={`rounded-2xl border p-3 active:opacity-80 ${
            item.read_at ? "border-border bg-bg-card" : "border-accent/30 bg-accent/10"
          }`}
        >
          <View className="flex-row items-start gap-2">
            <Bell size={16} color={item.read_at ? "#9aa0a8" : "#39ff8a"} />
            <View className="flex-1">
              <Text className="font-bold text-fg">{notificationTitle(item.type, item.title)}</Text>
              <Text className="mt-0.5 text-sm text-fg-muted">{item.body}</Text>
              <Text className="mt-1 text-xs text-fg-subtle">{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

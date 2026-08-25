import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/hooks/useNotifications";
import { unreadNotificationCount } from "@/lib/notificationRead";
import { recruitmentNotificationNav } from "@/lib/recruitment";
import { inAppNotificationHref, notificationTitle } from "@/lib/safety";
import { toast } from "@/lib/toast";
import { timeAgo } from "@/lib/utils";
import type { NotificationRow } from "@/lib/types";

/** Liste des notifications in-app — extraite de app/notifications.tsx pour l'onglet Activité. */
export function NotificationsList() {
  const { session } = useAuth();
  const { mode, setMode, setSelectedManagedClubId } = useAppMode();
  const userId = session?.user.id ?? null;
  const { data, isLoading, isError, refetch } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAll = useMarkAllNotificationsRead(userId);
  const unread = unreadNotificationCount(data ?? []);
  const [pendingNav, setPendingNav] = useState<{ href: string; requireClubMode: boolean } | null>(null);

  // Navigation après commit React : setMode("CLUB") doit avoir monté l'arbre
  // (club) avant router.push("/candidatures") — même doctrine que create-club.
  useEffect(() => {
    if (!pendingNav) return;
    if (pendingNav.requireClubMode && mode !== "CLUB") return;
    router.push(pendingNav.href as any);
    setPendingNav(null);
  }, [pendingNav, mode]);

  const open = (item: NotificationRow) => {
    if (!item.read_at) markRead.mutate(item.id);
    const recruitment = recruitmentNotificationNav(item.type, item.data);
    if (recruitment) {
      if (recruitment.selectClubId) setSelectedManagedClubId(recruitment.selectClubId);
      if (recruitment.requireClubMode) setMode("CLUB");
      setPendingNav({ href: recruitment.href, requireClubMode: recruitment.requireClubMode });
      return;
    }
    router.push(inAppNotificationHref(item.type, item.data, mode) as any);
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
        <Button
          variant="secondary"
          className="mb-1 min-h-[44px]"
          loading={markAll.isPending}
          accessibilityLabel="Tout marquer lu"
          onPress={() => {
            toast.info("Marquage en cours…");
            markAll.mutate(undefined, {
              onSuccess: () => toast.success("Toutes tes notifications sont lues."),
              onError: (err: Error) => toast.error(err.message || "Impossible de tout marquer lu."),
            });
          }}
        >
          Tout marquer lu
        </Button>
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

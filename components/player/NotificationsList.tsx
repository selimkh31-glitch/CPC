import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { NotificationRow } from "@/components/ui/NotificationRow";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/hooks/useNotifications";
import { unreadNotificationCount } from "@/lib/notificationRead";
import { recruitmentNotificationNav } from "@/lib/recruitment";
import {
  inAppNotificationHref,
  matchFinalizedNotificationNav,
  notificationTitle,
  tournamentRoundScheduledNotificationNav,
} from "@/lib/safety";
import { toast } from "@/lib/toast";
import { effectiveAppMode } from "@/lib/appMode";
import type { NotificationRow as NotificationRowType } from "@/lib/types";

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

  const open = (item: NotificationRowType) => {
    if (!item.read_at) markRead.mutate(item.id);
    const recruitment = recruitmentNotificationNav(item.type, item.data);
    if (recruitment) {
      if (recruitment.selectClubId) setSelectedManagedClubId(recruitment.selectClubId);
      if (recruitment.requireClubMode) setMode("CLUB");
      setPendingNav({ href: recruitment.href, requireClubMode: recruitment.requireClubMode });
      return;
    }
    const life = effectiveAppMode(mode);
    const matchNav = matchFinalizedNotificationNav(item.type, item.data, life);
    if (matchNav) {
      if (matchNav.selectClubId) setSelectedManagedClubId(matchNav.selectClubId);
      if (matchNav.requireClubMode) setMode("CLUB");
      setPendingNav({ href: matchNav.href, requireClubMode: matchNav.requireClubMode });
      return;
    }
    const tournamentNav = tournamentRoundScheduledNotificationNav(item.type, item.data, life);
    if (tournamentNav) {
      if (tournamentNav.selectClubId) setSelectedManagedClubId(tournamentNav.selectClubId);
      if (tournamentNav.requireClubMode) setMode("CLUB");
      setPendingNav({ href: tournamentNav.href, requireClubMode: tournamentNav.requireClubMode });
      return;
    }
    router.push(inAppNotificationHref(item.type, item.data, life) as any);
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
        title="Rien pour l'instant."
        subtitle="Tes invitations, tes matchs et tes retours arriveront ici."
      />
    );
  }

  return (
    <View className="gap-2">
      {unread > 0 && (
        <Button
          variant="ghost"
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
        <NotificationRow
          key={item.id}
          title={notificationTitle(item.type, item.title)}
          body={item.body}
          at={item.created_at}
          read={Boolean(item.read_at)}
          onPress={() => open(item)}
        />
      ))}
    </View>
  );
}

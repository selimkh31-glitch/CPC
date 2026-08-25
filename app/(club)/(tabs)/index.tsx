import { useCallback, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { LiveSessionPanel } from "@/components/club/LiveSessionPanel";
import { LivePlayersRecruitPanel } from "@/components/club/LivePlayersRecruitPanel";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useActiveMatchCheckin } from "@/lib/hooks/useMatchCheckin";
import { canMutateClub, clubSessionSnapshot } from "@/lib/sessionState";
import { formatLiveRemaining, liveUiState, LIVE_UX_COPY } from "@/lib/live";

/**
 * LIVE Mode Club — un état (off / open / ready), un CTA primaire.
 * Feuille de match = secondaire (ghost). Matching / TTL inchangés.
 */
export default function ClubLiveTab() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { data: club, isLoading, isError, refetch, isFetching } = useManagedClub();
  const { data: activeCheckin } = useActiveMatchCheckin(club?.id ?? null);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </SafeAreaView>
  );

  if (isLoading || (isFetching && !club && !isError)) {
    return shell(<Skeleton className="h-40" />);
  }

  if (isError) {
    return shell(<ErrorState message="Impossible de charger ce club." onRetry={refetch} />);
  }

  if (!club) {
    return shell(
      <View className="gap-4">
        <EmptyState
          title="Aucun club géré"
          subtitle="Crée un club, ou fais-toi nommer manager."
        />
        <Button
          className="min-h-[48px]"
          onPress={() => router.push("/create-club")}
        >
          Créer un club
        </Button>
      </View>
    );
  }

  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const canManage = canMutateClub(myMembership?.role);
  const snapshot = clubSessionSnapshot(club.sessions, activeCheckin ?? null, now);
  const liveSession = snapshot.live.active
    ? {
        id: snapshot.live.sessionId,
        needed_positions: snapshot.live.neededPositions,
        note: snapshot.live.note,
        expires_at: snapshot.live.expiresAt,
        is_live: true as const,
      }
    : null;
  const owner = club.members?.find((m) => m.user_id === club.owner_id);
  const uiState = liveUiState({
    liveActive: Boolean(snapshot.live.active),
    matchActive: Boolean(snapshot.match.active),
  });

  return shell(
    <>
      <Text className="font-display text-2xl text-fg">{LIVE_UX_COPY.title}</Text>

      {uiState === "ready" ? (
        <View className="rounded-[28px] border border-white/10 bg-bg-card px-6 py-6">
          <Text className="font-display text-2xl text-fg">{LIVE_UX_COPY.readyTitle}</Text>
          <Text className="mb-5 mt-2 text-sm text-fg-muted">Tout le monde est là.</Text>
          <Button variant="ghost" className="min-h-[44px]" onPress={() => router.push("/match")}>
            {LIVE_UX_COPY.matchSheet}
          </Button>
          {liveSession ? (
            <Text className="mt-3 text-sm text-fg-subtle">
              {LIVE_UX_COPY.clubStillLooking}
              {liveSession.expires_at ? ` · ${formatLiveRemaining(liveSession.expires_at, now)}` : ""}
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <LiveSessionPanel clubId={club.id} activeSession={liveSession} canManage={canManage} />
          <Button variant="ghost" className="min-h-[44px]" onPress={() => router.push("/match")}>
            {LIVE_UX_COPY.matchSheet}
          </Button>
        </>
      )}

      {canManage && uiState === "open" ? (
        <LivePlayersRecruitPanel
          clubId={club.id}
          members={club.members ?? []}
          neededPositions={liveSession?.needed_positions ?? []}
          platform={owner?.user?.platform ?? null}
          clubLive={liveSession}
        />
      ) : null}
    </>
  );
}

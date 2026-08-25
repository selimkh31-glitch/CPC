import { useCallback, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { LiveSessionPanel } from "@/components/club/LiveSessionPanel";
import { LivePlayersRecruitPanel } from "@/components/club/LivePlayersRecruitPanel";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useActiveMatchCheckin } from "@/lib/hooks/useMatchCheckin";
import { canMutateClub, clubSessionSnapshot } from "@/lib/sessionState";
import { LIVE_UX_COPY } from "@/lib/live";

/**
 * LIVE Mode Club — un CTA primaire : Passer LIVE.
 * Feuille de match = secondaire. Matching / TTL inchangés.
 */
export default function ClubLiveTab() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { setMode } = useAppMode();
  const { data: club, isLoading, isError, refetch, isFetching } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
  const { data: activeCheckin } = useActiveMatchCheckin(club?.id ?? null);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <ModeSwitch managedClubs={managedClubs} />
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
          subtitle="Crée un club EA SPORTS FC 27 Pro Clubs en mode Joueur, ou fais-toi nommer manager."
        />
        <Button variant="ghost" onPress={() => setMode("PLAYER")}>
          Retour mode Joueur
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

  return shell(
    <>
      <View>
        <Text className="font-display text-2xl text-fg">{LIVE_UX_COPY.title}</Text>
        <Text className="mt-0.5 text-sm text-fg-muted">
          {club.name} — {LIVE_UX_COPY.clubHeadline}
        </Text>
      </View>

      <LiveSessionPanel clubId={club.id} activeSession={liveSession} canManage={canManage} />

      <Button
        variant={snapshot.match.active ? "secondary" : "ghost"}
        onPress={() => router.push("/match")}
        className="min-h-[44px]"
      >
        {snapshot.match.active ? "Ouvrir la feuille de match" : "Feuille de match"}
      </Button>

      {canManage && (
        <LivePlayersRecruitPanel
          clubId={club.id}
          members={club.members ?? []}
          neededPositions={liveSession?.needed_positions ?? []}
          platform={owner?.user?.platform ?? null}
          clubLive={liveSession}
        />
      )}
    </>
  );
}

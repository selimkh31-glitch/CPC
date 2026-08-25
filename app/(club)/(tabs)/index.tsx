import { useCallback, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { LiveSessionPanel } from "@/components/club/LiveSessionPanel";
import { LivePlayersRecruitPanel } from "@/components/club/LivePlayersRecruitPanel";
import { ManagedClubEmpty } from "@/components/club/ManagedClubEmpty";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useActiveMatchCheckin } from "@/lib/hooks/useMatchCheckin";
import { canMutateClub, clubSessionSnapshot } from "@/lib/sessionState";
import {
  CLUB_MATCH_SHEET_HREF,
  LIVE_UX_COPY,
  clubLiveLayout,
} from "@/lib/live";

/**
 * LIVE Mode Club — Passer LIVE reste le CTA de recherche. Un match lancé
 * n'enferme pas l'écran : Feuille = bouton rempli vers `/match`.
 * Matching / TTL inchangés.
 */
export default function ClubLiveTab() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: activeCheckin } = useActiveMatchCheckin(club?.id ?? null);

  useFocusEffect(
    useCallback(() => {
      if (!club) return;
      refetch();
    }, [club, refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </SafeAreaView>
  );

  if (isLoading) {
    return shell(<Skeleton className="h-40" />);
  }

  if (!club) {
    return shell(<ManagedClubEmpty />);
  }

  if (isError) {
    // Refetch focus a échoué : on garde la feuille LIVE, pas un overlay qui coupe.
  }

  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const canManage = canMutateClub(myMembership?.role);
  const snapshot = clubSessionSnapshot(club.sessions, activeCheckin ?? null, now);
  const liveActive = snapshot.live.active;
  const matchActive = snapshot.match.active;
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
  const layout = clubLiveLayout({ canManage, liveActive, matchActive });

  const openMatchSheet = () => {
    router.push(CLUB_MATCH_SHEET_HREF);
  };

  return shell(
    <>
      {isError ? <ErrorState message="Impossible de charger ce club." onRetry={refetch} /> : null}
      <Text className="font-display text-2xl text-fg">{LIVE_UX_COPY.title}</Text>

      {layout.showSessionPanel ? (
        <LiveSessionPanel
          clubId={club.id}
          activeSession={liveSession}
          canManage={canManage}
          stopLabel={layout.stopLabel}
        />
      ) : null}

      {layout.matchSheetFilled ? (
        <View className="gap-2">
          <Text className="font-display text-xl text-fg">{LIVE_UX_COPY.readyTitle}</Text>
          <Text className="text-sm text-fg-muted">Tout le monde est là.</Text>
          <Button
            size="lg"
            className="min-h-[48px]"
            accessibilityLabel={LIVE_UX_COPY.matchSheet}
            onPress={openMatchSheet}
          >
            {LIVE_UX_COPY.matchSheet}
          </Button>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={LIVE_UX_COPY.matchSheet}
          onPress={openMatchSheet}
          className="min-h-[44px] justify-center"
        >
          <Text className="text-base font-bold text-accent">{LIVE_UX_COPY.matchSheet}</Text>
        </Pressable>
      )}

      {layout.showRecruit ? (
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

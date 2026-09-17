import { Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { AppShell } from "@/components/nav/AppShell";
import { ApplyForm } from "@/components/club/ApplyForm";
import { MatchHistoryList } from "@/components/profile/MatchHistoryList";
import { StartDirectMessageButton } from "@/components/social/StartDirectMessageButton";
import { FormationPitch } from "@/components/club/FormationPitch";
import { ClubRosterList } from "@/components/club/ClubRosterList";
import { useClub } from "@/lib/hooks/useClubs";
import { useClubMatchHistory } from "@/lib/hooks/useMatchHistory";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useBlockedUserIds } from "@/lib/hooks/useSafety";
import { isClubHiddenByBlock, shouldHideContactCta } from "@/lib/safety";
import { findActiveLiveSession } from "@/lib/live";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { sortClubRoster } from "@/lib/clubProfile";
import { buildClubLiveRowMeta } from "@/lib/clubLiveRow";
import { numberedPositionSlots } from "@/lib/sessionState";
import type { FormationId } from "@/lib/formations";

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: club, isLoading, isError, refetch } = useClub(id);
  const {
    data: matchHistory,
    isLoading: matchHistoryLoading,
    isError: matchHistoryError,
    refetch: refetchMatchHistory,
  } = useClubMatchHistory(id ?? null, club?.name);
  const { session } = useAuth();
  const { data: blockedIds } = useBlockedUserIds(session?.user.id ?? null);
  const now = useLiveClock();

  if (isError) {
    return (
      <AppShell>
        <ErrorState message="Impossible de charger ce club." onRetry={refetch} />
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell contentContainerStyle={{ gap: 12 }}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </AppShell>
    );
  }

  if (!club) {
    return (
      <AppShell>
        <EmptyState title="Ce club n'est plus là." subtitle="Il a été retiré, ou tu n'y as plus accès." />
      </AppShell>
    );
  }

  const activeSession = findActiveLiveSession(club.sessions, now);
  const isMember = session ? club.members?.some((m) => m.user_id === session.user.id) : false;
  const memberCount = Array.isArray(club.members) ? club.members.length : null;
  const headerMeta = buildClubLiveRowMeta({
    languages: club.languages,
    level: club.level,
    memberCount,
    form: null,
    clubId: club.id,
    isDev: false,
  });
  const neededSlots = numberedPositionSlots(activeSession?.needed_positions);
  const showMatchHistory = matchHistoryLoading || matchHistoryError || (matchHistory?.length ?? 0) > 0;
  const formationId = (club.formation as FormationId | null) ?? null;
  const assignments = club.slotAssignments ?? [];

  return (
    <AppShell contentContainerStyle={{ gap: 16 }}>
      <View className="min-h-[44px] flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-display text-titleSmall text-fg">
            {club.name}
          </Text>
          {headerMeta ? (
            <Text numberOfLines={1} className="mt-0.5 font-sans text-bodySmall text-fg-muted">
              {headerMeta}
            </Text>
          ) : null}
        </View>
        {activeSession ? <LiveBadge /> : null}
      </View>

      {isMember ? (
        <Link href={`/match-sheet?clubId=${club.id}`} className="min-h-[44px] justify-center font-sans-semibold text-body text-accent">
          Voir la feuille de match
        </Link>
      ) : null}

      {showMatchHistory ? (
        <MatchHistoryList
          items={matchHistory}
          loading={matchHistoryLoading}
          error={matchHistoryError}
          onRetry={refetchMatchHistory}
        />
      ) : null}

      <SurfaceCard>
        <SectionHeader title="Session" />
        {activeSession ? (
          <>
            <View className="mb-3 flex-row flex-wrap gap-1.5">
              {neededSlots.map((item) => (
                <PositionBadge key={item.slot}>{item.slot}</PositionBadge>
              ))}
            </View>
            {activeSession.note && <Text className="mb-3 font-sans text-body text-fg-muted">{activeSession.note}</Text>}
            {session && !isMember && !isClubHiddenByBlock(club, blockedIds ?? []) ? (
              <ApplyForm sessionId={activeSession.id} neededPositions={activeSession.needed_positions} />
            ) : session && !isMember && isClubHiddenByBlock(club, blockedIds ?? []) ? (
              <Text className="font-sans text-body text-fg-muted">Tu ne peux pas postuler à ce club (blocage).</Text>
            ) : !session ? (
              <Link href="/(auth)/login" className="min-h-[44px] justify-center font-sans-semibold text-body text-accent">
                Connecte-toi pour postuler
              </Link>
            ) : (
              <Text className="font-sans text-caption text-fg-subtle">Tu es déjà membre de ce club.</Text>
            )}
          </>
        ) : (
          <Text className="font-sans text-body text-fg-muted">Ce club n&apos;est pas live actuellement.</Text>
        )}
      </SurfaceCard>

      {formationId ? (
        <View className="gap-2">
          <SectionHeader title="Feuille" />
          <FormationPitch
            formationId={formationId}
            assignments={assignments}
            interactive={false}
            currentUserId={session?.user.id ?? null}
            clubId={club.id}
          />
        </View>
      ) : null}

      <ClubRosterList members={club.members} currentUserId={session?.user.id ?? null} clubId={club.id} />

      {isMember ? (
        <View className="gap-2">
          {sortClubRoster(club.members ?? [])
            .filter((m) => session?.user.id !== m.user_id)
            .map((m) => (
              <View key={`dm-${m.id}`} className="min-h-[44px] flex-row items-center justify-between">
                <Text className="min-w-0 flex-1 font-sans text-body text-fg" numberOfLines={1}>
                  {m.user?.username?.trim() || "Joueur"}
                </Text>
                <StartDirectMessageButton otherUserId={m.user_id} blocked={shouldHideContactCta(m.user_id, blockedIds)} />
              </View>
            ))}
        </View>
      ) : null}
    </AppShell>
  );
}

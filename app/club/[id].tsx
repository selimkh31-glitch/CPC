import { ScrollView, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { PulseDot } from "@/components/ui/PulseDot";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { ApplyForm } from "@/components/club/ApplyForm";
import { MatchHistoryList } from "@/components/profile/MatchHistoryList";
import { StartDirectMessageButton } from "@/components/social/StartDirectMessageButton";
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
import type { ClubRole } from "@/lib/types";

const ROLE_LABEL: Record<ClubRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  MEMBER: "Membre",
};

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
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <ErrorState message="Impossible de charger ce club." onRetry={refetch} />
      </ScrollView>
    );
  }

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </ScrollView>
    );
  }

  if (!club) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title="Ce club n'est plus là." subtitle="Il a été retiré, ou tu n'y as plus accès." />
      </ScrollView>
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

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
      <View className="min-h-[44px] flex-row items-center gap-2">
        <Avatar username={club.name} size="sm" />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[16px] font-semibold text-fg">
            {club.name}
          </Text>
          {headerMeta ? (
            <Text numberOfLines={1} className="text-[13px] text-fg-muted">
              {headerMeta}
            </Text>
          ) : null}
        </View>
        {activeSession ? (
          <View className="flex-row items-center gap-1">
            <PulseDot />
            <Text className="text-[11px] font-bold uppercase tracking-wide text-accent">LIVE</Text>
          </View>
        ) : null}
      </View>

      {isMember ? (
        <Link href={`/match-sheet?clubId=${club.id}`} className="text-sm text-accent">
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

      <View>
        <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Session</Text>
        {activeSession ? (
          <>
            <View className="mb-3 flex-row flex-wrap gap-1.5">
              {neededSlots.map((item) => (
                <Badge key={item.slot} tone="pro">
                  {item.slot}
                </Badge>
              ))}
            </View>
            {activeSession.note && <Text className="mb-3 text-sm text-fg-muted">{activeSession.note}</Text>}
            {session && !isMember && !isClubHiddenByBlock(club, blockedIds ?? []) ? (
              <ApplyForm sessionId={activeSession.id} neededPositions={activeSession.needed_positions} />
            ) : session && !isMember && isClubHiddenByBlock(club, blockedIds ?? []) ? (
              <Text className="text-sm text-fg-muted">Tu ne peux pas postuler à ce club (blocage).</Text>
            ) : !session ? (
              <Link href="/(auth)/login" className="text-sm text-accent">
                Connecte-toi pour postuler
              </Link>
            ) : (
              <Text className="text-sm text-fg-subtle">Tu es déjà membre de ce club.</Text>
            )}
          </>
        ) : (
          <Text className="text-sm text-fg-muted">Ce club n&apos;est pas live actuellement.</Text>
        )}
      </View>

      <View>
        <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">
          Membres ({club.members?.length ?? 0})
        </Text>
        <View className="gap-1.5">
          {sortClubRoster(club.members ?? []).map((m) => {
            const isSelf = session?.user.id === m.user_id;
            const name = m.user?.username?.trim() || "Joueur";
            const blocked = shouldHideContactCta(m.user_id, blockedIds);
            return (
              <View key={m.id} className="min-h-[44px] flex-row items-center gap-2">
                <Avatar username={name} size="sm" />
                <Text numberOfLines={1} className="min-w-0 flex-1 text-[14px] font-medium text-fg">
                  {name}
                </Text>
                <Badge tone={m.role === "OWNER" ? "pro" : m.role === "MANAGER" ? "accent" : "neutral"}>
                  {ROLE_LABEL[m.role]}
                </Badge>
                {isMember && !isSelf ? (
                  <StartDirectMessageButton otherUserId={m.user_id} blocked={blocked} />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

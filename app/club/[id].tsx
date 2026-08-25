import { ScrollView, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Users } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { ApplyForm } from "@/components/club/ApplyForm";
import { ClubCard } from "@/components/club/ClubCard";
import { MatchHistoryList } from "@/components/profile/MatchHistoryList";
import { PlayerCard } from "@/components/player/PlayerCard";
import { StartDirectMessageButton } from "@/components/social/StartDirectMessageButton";
import { useClub } from "@/lib/hooks/useClubs";
import { useClubMatchHistory } from "@/lib/hooks/useMatchHistory";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useBlockedUserIds } from "@/lib/hooks/useSafety";
import { isClubHiddenByBlock, shouldHideContactCta } from "@/lib/safety";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { findActiveLiveSession } from "@/lib/live";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { sortClubRoster } from "@/lib/clubProfile";
import { buildPlayerCardData } from "@/lib/playerCard";
import { buildClubCardDataFromHydratedClub } from "@/lib/clubCard";
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

  if (isLoading || !club) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </ScrollView>
    );
  }

  const activeSession = findActiveLiveSession(club.sessions, now);
  const isMember = session ? club.members?.some((m) => m.user_id === session.user.id) : false;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
      <ClubCard
        data={buildClubCardDataFromHydratedClub(club, {
          members: club.members,
          sessions: club.sessions,
          nowMs: now,
        })}
        variant="full"
        interactive={false}
        footer={
          <Link href={`/match-sheet?clubId=${club.id}`} className="text-sm text-accent">
            Voir la feuille de match
          </Link>
        }
      />

      <Card>
        <MatchHistoryList
          items={matchHistory}
          loading={matchHistoryLoading}
          error={matchHistoryError}
          onRetry={refetchMatchHistory}
        />
      </Card>

      <Card>
        <Text className="mb-2 font-display text-lg text-fg">Session</Text>
        {activeSession ? (
          <>
            <View className="mb-3 flex-row flex-wrap gap-1.5">
              {activeSession.needed_positions.map((p) => (
                <Badge key={p} tone="pro">
                  {POSITION_LABELS[p as PositionCode] ?? p}
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
      </Card>

      <Card>
        <View className="mb-2 flex-row items-center gap-2">
          <Users size={18} color="#f4f5f7" />
          <Text className="font-display text-lg text-fg">Membres ({club.members?.length ?? 0})</Text>
        </View>
        <View className="gap-2">
          {sortClubRoster(club.members ?? []).map((m) => {
            const isSelf = session?.user.id === m.user_id;
            const blocked = shouldHideContactCta(m.user_id, blockedIds);
            const roleBadge = (
              <Badge tone={m.role === "OWNER" ? "pro" : m.role === "MANAGER" ? "accent" : "neutral"}>
                {ROLE_LABEL[m.role]}
              </Badge>
            );
            const footer = (
              <View className="mt-2 gap-2">
                {roleBadge}
                {!isSelf && session ? <StartDirectMessageButton otherUserId={m.user_id} blocked={blocked} /> : null}
              </View>
            );
            if (!m.user) {
              return (
                <View key={m.id} className="gap-2 rounded-2xl border border-border bg-bg-elevated p-3">
                  <Text className="font-semibold text-fg-muted">Joueur</Text>
                  {footer}
                </View>
              );
            }
            return (
              <PlayerCard
                key={m.id}
                data={buildPlayerCardData(m.user, { clubName: club.name })}
                variant="mini"
                footer={footer}
              />
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}

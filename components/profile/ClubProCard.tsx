import { View, Text } from "react-native";
import { PlayerCard } from "@/components/player/PlayerCard";
import { ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchHistoryList } from "@/components/profile/MatchHistoryList";
import { buildPlayerCardData } from "@/lib/playerCard";
import type { UserRow } from "@/lib/types";
import type { MatchHistoryItem } from "@/lib/matchHistory";

/**
 * Profil joueur — densité FULL du système Player Card + historique réel.
 * Share API déjà en place (PlayerCard shareEnabled). Pas d'usine virale.
 */
export function ClubProCard({
  user,
  clubName,
  clubId,
  cpcMatchesPlayed,
  loading = false,
  error = false,
  onRetry,
  matchHistory,
  matchHistoryLoading = false,
  matchHistoryError = false,
  onRetryMatchHistory,
  onLinkEaClub,
}: {
  user?: UserRow | null;
  clubName?: string | null;
  clubId?: string | null;
  cpcMatchesPlayed?: number | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  matchHistory?: MatchHistoryItem[] | null;
  matchHistoryLoading?: boolean;
  matchHistoryError?: boolean;
  onRetryMatchHistory?: () => void;
  onLinkEaClub?: () => void;
}) {
  if (error) {
    return (
      <View className="w-full max-w-sm">
        <ErrorState message="Impossible de charger la carte joueur." onRetry={onRetry} />
      </View>
    );
  }

  if (loading) {
    return <Skeleton className="h-72 w-full max-w-sm rounded-[32px]" />;
  }

  if (!user?.username) {
    return (
      <View className="w-full max-w-sm items-center rounded-3xl border border-dashed border-border bg-bg-card px-5 py-10">
        <Text className="text-center font-display text-lg text-fg">Ta ClubPro Card</Text>
        <Text className="mt-2 text-center text-sm text-fg-muted">
          Profil incomplet — termine l&apos;onboarding pour afficher ta carte. Tu peux déjà passer LIVE sans club EA.
        </Text>
      </View>
    );
  }

  const data = buildPlayerCardData(user, {
    clubName: clubName ?? null,
    clubId: clubId ?? null,
    // Comptage PRESENT → match_results seulement. Jamais `matchHistory.length`
    // (une liste tronquée n'est pas « matchs CPC »).
    cpcMatchesPlayed,
  });

  return (
    <PlayerCard
      data={data}
      variant="full"
      interactive={false}
      shareEnabled
      onLinkEaClub={onLinkEaClub}
      footer={
        <View className="px-6 pb-6">
          <MatchHistoryList
            variant="embedded"
            items={matchHistory}
            loading={matchHistoryLoading}
            error={matchHistoryError}
            onRetry={onRetryMatchHistory}
          />
        </View>
      }
    />
  );
}

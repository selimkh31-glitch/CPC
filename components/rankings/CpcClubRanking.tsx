import { Text, View } from "react-native";
import { router } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { ClubCard } from "@/components/club/ClubCard";
import {
  RANKING_COPY,
  canShowCpcClubRanking,
  clubRankingRowHref,
  computeCpcClubStandings,
} from "@/lib/rankings";
import { buildClubCardData } from "@/lib/clubCard";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";

/**
 * Tableau clubs CPC — uniquement si ≥1 `match_results` avec `opponent_club_id`.
 * MINI ClubCard + points/W-D-L du standing réel. Pas de cartes géantes.
 */
export function CpcClubRanking({
  results,
  isLoading,
  isError,
  onRetry,
}: {
  results: LinkedMatchResultRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <View>
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
          {RANKING_COPY.clubTitle}
        </Text>
        <Skeleton className="h-16" />
      </View>
    );
  }

  if (isError) {
    return (
      <View>
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
          {RANKING_COPY.clubTitle}
        </Text>
        <ErrorState message={RANKING_COPY.clubLoadError} onRetry={onRetry} />
      </View>
    );
  }

  const rows = results ?? [];
  if (!canShowCpcClubRanking(rows)) {
    return (
      <View>
        <Text className="text-xs font-bold uppercase tracking-wide text-fg-muted">
          {RANKING_COPY.clubTitle}
        </Text>
        <Text className="mt-1 text-xs text-fg-muted">{RANKING_COPY.clubEmpty}</Text>
        <Text className="mt-0.5 text-xs text-fg-subtle">{RANKING_COPY.clubEmptyHint}</Text>
      </View>
    );
  }

  const names = new Map<string, string>();
  for (const row of rows) {
    if (row.club?.name) names.set(row.club_id, row.club.name);
    if (row.opponent_club_id && row.opponent_club?.name) names.set(row.opponent_club_id, row.opponent_club.name);
  }

  const standings = computeCpcClubStandings(rows);

  return (
    <View>
      <Text className="text-xs font-bold uppercase tracking-wide text-fg-muted">
        {RANKING_COPY.clubTitle}
      </Text>
      <Text className="mt-1 mb-2 text-xs text-fg-subtle">{RANKING_COPY.clubSubtitle}</Text>
      <View className="gap-1.5">
        {standings.map((row, index) => {
          const diff = row.goalsFor - row.goalsAgainst;
          const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
          const clubName = names.get(row.clubId);
          const href = clubRankingRowHref(row.clubId, clubName);
          const displayName = clubName ?? "Club Pro Clubs";
          return (
            <ClubCard
              key={row.clubId}
              data={buildClubCardData(
                { id: row.clubId, name: displayName },
                {
                  matchRecord: {
                    played: row.played,
                    wins: row.wins,
                    draws: row.draws,
                    losses: row.losses,
                    points: row.points,
                  },
                }
              )}
              variant="mini"
              interactive={Boolean(href)}
              onPress={href ? () => router.push(href) : undefined}
              rightSlot={
                <View className="flex-row items-center gap-2">
                  <Text className="text-[10px] font-bold text-fg-subtle">#{index + 1}</Text>
                  <Text className="text-xs text-fg">{row.played}J</Text>
                  <Text className="text-xs text-fg">{row.wins}V</Text>
                  <Text className="text-xs text-fg">{row.draws}N</Text>
                  <Text className="text-xs text-fg">{row.losses}D</Text>
                  <Text className="text-xs text-fg">{diffLabel}</Text>
                  <Text className="text-sm font-bold text-accent">{row.points}</Text>
                </View>
              }
            />
          );
        })}
      </View>
    </View>
  );
}

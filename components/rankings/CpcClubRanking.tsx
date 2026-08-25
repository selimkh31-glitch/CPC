import { Text, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import {
  RANKING_COPY,
  canShowCpcClubRanking,
  computeCpcClubStandings,
} from "@/lib/rankings";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";

/**
 * Tableau clubs CPC — uniquement si ≥1 `match_results` avec `opponent_club_id`.
 * Pas de classement joueur (join trop mince). Pas de `season_stats`.
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
      <View className="mb-1 flex-row px-1">
        <Text className="w-8 text-[10px] font-bold uppercase text-fg-subtle">#</Text>
        <Text className="flex-1 text-[10px] font-bold uppercase text-fg-subtle">Club</Text>
        <Text className="w-7 text-right text-[10px] font-bold uppercase text-fg-subtle">J</Text>
        <Text className="w-7 text-right text-[10px] font-bold uppercase text-fg-subtle">V</Text>
        <Text className="w-7 text-right text-[10px] font-bold uppercase text-fg-subtle">N</Text>
        <Text className="w-7 text-right text-[10px] font-bold uppercase text-fg-subtle">D</Text>
        <Text className="w-9 text-right text-[10px] font-bold uppercase text-fg-subtle">Diff</Text>
        <Text className="w-9 text-right text-[10px] font-bold uppercase text-fg-subtle">Pts</Text>
      </View>
      {standings.map((row, index) => {
        const diff = row.goalsFor - row.goalsAgainst;
        const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
        return (
          <View key={row.clubId} className="min-h-[36px] flex-row items-center px-1 py-1">
            <Text className="w-8 text-xs text-fg-muted">{index + 1}</Text>
            <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-fg">
              {names.get(row.clubId) ?? "Club Pro Clubs"}
            </Text>
            <Text className="w-7 text-right text-xs text-fg">{row.played}</Text>
            <Text className="w-7 text-right text-xs text-fg">{row.wins}</Text>
            <Text className="w-7 text-right text-xs text-fg">{row.draws}</Text>
            <Text className="w-7 text-right text-xs text-fg">{row.losses}</Text>
            <Text className="w-9 text-right text-xs text-fg">{diffLabel}</Text>
            <Text className="w-9 text-right text-sm font-bold text-accent">{row.points}</Text>
          </View>
        );
      })}
    </View>
  );
}

import { Text, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import {
  COMPETITION_COPY,
  canShowCompetitionStandings,
  computeCompetitionStandings,
} from "@/lib/competitions";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import type { CompetitionRow } from "@/lib/types";

export function CompetitionStandings({
  competition,
  results,
  isLoading,
  isError,
  onRetry,
}: {
  competition: CompetitionRow;
  results: LinkedMatchResultRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <View className="mt-3">
        <Skeleton className="h-16" />
      </View>
    );
  }
  if (isError) {
    return (
      <View className="mt-3">
        <ErrorState message={COMPETITION_COPY.standingsLoadError} onRetry={onRetry} />
      </View>
    );
  }

  const rows = results ?? [];
  if (!canShowCompetitionStandings(rows, competition.id)) {
    return (
      <View className="mt-3">
        <Text className="text-xs font-bold uppercase tracking-wide text-fg-muted">
          {COMPETITION_COPY.standingsTitle}
        </Text>
        <Text className="mt-1 text-xs text-fg-muted">{COMPETITION_COPY.standingsEmpty}</Text>
        <Text className="mt-0.5 text-xs text-fg-subtle">{COMPETITION_COPY.standingsEmptyHint}</Text>
      </View>
    );
  }

  const names = new Map<string, string>();
  for (const row of competition.clubs ?? []) {
    if (row.club?.name) names.set(row.club_id, row.club.name);
  }
  for (const row of rows) {
    if (row.club?.name) names.set(row.club_id, row.club.name);
    if (row.opponent_club_id && row.opponent_club?.name) names.set(row.opponent_club_id, row.opponent_club.name);
  }

  const standings = computeCompetitionStandings(rows, competition.id);

  return (
    <View className="mt-3">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
        {COMPETITION_COPY.standingsTitle}
      </Text>
      <View className="mb-1 flex-row px-1">
        <Text className="w-8 text-[10px] font-bold uppercase text-fg-subtle">#</Text>
        <Text className="flex-1 text-[10px] font-bold uppercase text-fg-subtle">Club</Text>
        <Text className="w-7 text-right text-[10px] font-bold uppercase text-fg-subtle">J</Text>
        <Text className="w-7 text-right text-[10px] font-bold uppercase text-fg-subtle">V</Text>
        <Text className="w-7 text-right text-[10px] font-bold uppercase text-fg-subtle">N</Text>
        <Text className="w-7 text-right text-[10px] font-bold uppercase text-fg-subtle">D</Text>
        <Text className="w-9 text-right text-[10px] font-bold uppercase text-fg-subtle">Pts</Text>
      </View>
      {standings.map((row, index) => (
        <View key={row.clubId} className="min-h-[36px] flex-row items-center px-1 py-1">
          <Text className="w-8 text-xs text-fg-muted">{index + 1}</Text>
          <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-fg">
            {names.get(row.clubId) ?? "Club Pro Clubs"}
          </Text>
          <Text className="w-7 text-right text-xs text-fg">{row.played}</Text>
          <Text className="w-7 text-right text-xs text-fg">{row.wins}</Text>
          <Text className="w-7 text-right text-xs text-fg">{row.draws}</Text>
          <Text className="w-7 text-right text-xs text-fg">{row.losses}</Text>
          <Text className="w-9 text-right text-sm font-bold text-accent">{row.points}</Text>
        </View>
      ))}
    </View>
  );
}

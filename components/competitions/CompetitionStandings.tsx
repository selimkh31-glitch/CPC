import { Text, View } from "react-native";
import { router } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { ClubCard } from "@/components/club/ClubCard";
import {
  COMPETITION_COPY,
  canShowCompetitionStandings,
  computeCompetitionStandings,
} from "@/lib/competitions";
import { buildClubCardData } from "@/lib/clubCard";
import { clubRankingRowHref } from "@/lib/rankings";
import { tournamentClubDisplayName, rememberClubDisplayName } from "@/lib/tournaments";
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
    rememberClubDisplayName(names, row.club_id, row.club?.name);
  }
  for (const row of rows) {
    rememberClubDisplayName(names, row.club_id, row.club?.name);
    rememberClubDisplayName(names, row.opponent_club_id, row.opponent_club?.name);
  }

  const standings = computeCompetitionStandings(rows, competition.id);

  return (
    <View className="mt-3">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
        {COMPETITION_COPY.standingsTitle}
      </Text>
      <Text className="mb-1 px-1 text-[10px] font-bold uppercase text-fg-subtle">
        # · J · V · N · D · Pts
      </Text>
      <View className="gap-1.5">
        {standings.map((row, index) => {
          const display = tournamentClubDisplayName(names.get(row.clubId));
          const href = clubRankingRowHref(row.clubId, display);
          const stats = (
            <View className="flex-row items-center gap-2">
              <Text className="text-[10px] font-bold text-fg-subtle">#{index + 1}</Text>
              <Text className="text-xs text-fg">{row.played}J</Text>
              <Text className="text-xs text-fg">{row.wins}V</Text>
              <Text className="text-xs text-fg">{row.draws}N</Text>
              <Text className="text-xs text-fg">{row.losses}D</Text>
              <Text className="text-sm font-bold text-accent">{row.points}</Text>
            </View>
          );
          if (!display) {
            return (
              <View
                key={row.clubId}
                className="min-h-[44px] flex-row items-center justify-end rounded-2xl border border-accent/30 bg-bg-card px-3 py-2"
              >
                {stats}
              </View>
            );
          }
          return (
            <ClubCard
              key={row.clubId}
              data={buildClubCardData({ id: row.clubId, name: display })}
              variant="mini"
              interactive={Boolean(href)}
              onPress={href ? () => router.push(href) : undefined}
              rightSlot={stats}
            />
          );
        })}
      </View>
    </View>
  );
}

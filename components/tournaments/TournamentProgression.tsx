import { Text, View } from "react-native";
import {
  collectTournamentClubNames,
  latestRoundNumber,
  matchesInRound,
  TOURNAMENT_COPY,
  tournamentChampionClubId,
  tournamentMatchWinnerId,
} from "@/lib/tournaments";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import type { CompetitionRow, TournamentMatchRow, TournamentRoundClubRow } from "@/lib/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { TournamentClubMini } from "@/components/tournaments/TournamentClubMini";

/** Qualifiés / vainqueur = uniquement des résultats PLAYED liés. Pas de 0-0 inventé. */
export function TournamentProgression({
  tournament,
  matches,
  roundClubs,
  results,
  isLoading,
  isError,
  onRetry,
}: {
  tournament: CompetitionRow;
  matches: TournamentMatchRow[] | undefined;
  roundClubs: TournamentRoundClubRow[] | undefined;
  results: LinkedMatchResultRow[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  if (isLoading) {
    return (
      <View>
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
          {TOURNAMENT_COPY.championTitle}
        </Text>
        <Skeleton className="h-12" />
      </View>
    );
  }

  if (isError) {
    return (
      <View>
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
          {TOURNAMENT_COPY.championTitle}
        </Text>
        <ErrorState message={TOURNAMENT_COPY.matchesLoadError} onRetry={onRetry} />
      </View>
    );
  }
  const rows = matches ?? [];
  const linked = results ?? [];
  const pool = roundClubs ?? [];
  const names = collectTournamentClubNames(tournament.clubs ?? [], rows);

  const championId = tournamentChampionClubId(rows, linked, pool);
  const latest = latestRoundNumber(rows);
  const latestWinners: string[] = [];
  if (latest != null) {
    const seen = new Set<string>();
    for (const match of matchesInRound(rows, latest)) {
      const winnerId = tournamentMatchWinnerId(match, linked);
      if (!winnerId || seen.has(winnerId)) continue;
      seen.add(winnerId);
      latestWinners.push(winnerId);
    }
  }

  return (
    <View>
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-fg-muted">
        {TOURNAMENT_COPY.championTitle}
      </Text>
      {championId ? (
        <View className="mb-3">
          <TournamentClubMini clubId={championId} name={names.get(championId)} />
        </View>
      ) : (
        <>
          <Text className="text-xs text-fg-muted">{TOURNAMENT_COPY.championEmpty}</Text>
          <Text className="mb-3 mt-0.5 text-xs text-fg-subtle">{TOURNAMENT_COPY.championHint}</Text>
        </>
      )}

      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-fg-muted">
        {TOURNAMENT_COPY.progressionTitle}
      </Text>
      {latestWinners.length === 0 ? (
        <>
          <Text className="text-xs text-fg-muted">{TOURNAMENT_COPY.progressionEmpty}</Text>
          <Text className="mt-0.5 text-xs text-fg-subtle">{TOURNAMENT_COPY.progressionHint}</Text>
        </>
      ) : (
        <View className="gap-1.5">
          {latestWinners.map((clubId) => (
            <TournamentClubMini key={clubId} clubId={clubId} name={names.get(clubId)} />
          ))}
        </View>
      )}
    </View>
  );
}

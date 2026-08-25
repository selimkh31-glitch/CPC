import { Text, View } from "react-native";
import {
  latestRoundNumber,
  matchesInRound,
  TOURNAMENT_COPY,
  tournamentChampionClubId,
  tournamentMatchWinnerId,
} from "@/lib/tournaments";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import type { CompetitionRow, TournamentMatchRow, TournamentRoundClubRow } from "@/lib/types";

/** Qualifiés / vainqueur = uniquement des résultats PLAYED liés. Pas de 0-0 inventé. */
export function TournamentProgression({
  tournament,
  matches,
  roundClubs,
  results,
}: {
  tournament: CompetitionRow;
  matches: TournamentMatchRow[] | undefined;
  roundClubs: TournamentRoundClubRow[] | undefined;
  results: LinkedMatchResultRow[] | undefined;
}) {
  const rows = matches ?? [];
  const linked = results ?? [];
  const pool = roundClubs ?? [];
  const names = new Map<string, string>();
  for (const row of tournament.clubs ?? []) {
    if (row.club?.name) names.set(row.club_id, row.club.name);
  }
  for (const match of rows) {
    if (match.club_a?.name) names.set(match.club_a_id, match.club_a.name);
    if (match.club_b?.name) names.set(match.club_b_id, match.club_b.name);
  }

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
        <Text className="mb-3 text-base font-bold text-accent">
          {names.get(championId) ?? "Club Pro Clubs"}
        </Text>
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
        <View className="gap-1">
          {latestWinners.map((clubId) => (
            <Text key={clubId} className="text-sm font-semibold text-fg">
              {names.get(clubId) ?? "Club Pro Clubs"}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

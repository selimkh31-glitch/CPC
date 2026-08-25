import { Text, View } from "react-native";
import { TOURNAMENT_COPY, tournamentQualifiedClubIds } from "@/lib/tournaments";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import type { CompetitionRow, TournamentMatchRow } from "@/lib/types";

/** Qualifiés = vainqueurs de matchs avec résultat lié uniquement. Pas de 0-0. */
export function TournamentProgression({
  tournament,
  matches,
  results,
}: {
  tournament: CompetitionRow;
  matches: TournamentMatchRow[] | undefined;
  results: LinkedMatchResultRow[] | undefined;
}) {
  const rows = matches ?? [];
  const linked = results ?? [];
  const names = new Map<string, string>();
  for (const row of tournament.clubs ?? []) {
    if (row.club?.name) names.set(row.club_id, row.club.name);
  }
  for (const match of rows) {
    if (match.club_a?.name) names.set(match.club_a_id, match.club_a.name);
    if (match.club_b?.name) names.set(match.club_b_id, match.club_b.name);
  }

  const qualified = tournamentQualifiedClubIds(rows, linked);

  return (
    <View>
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-fg-muted">
        {TOURNAMENT_COPY.progressionTitle}
      </Text>
      {qualified.length === 0 ? (
        <>
          <Text className="text-xs text-fg-muted">{TOURNAMENT_COPY.progressionEmpty}</Text>
          <Text className="mt-0.5 text-xs text-fg-subtle">{TOURNAMENT_COPY.progressionHint}</Text>
        </>
      ) : (
        <View className="gap-1">
          {qualified.map((clubId) => (
            <Text key={clubId} className="text-sm font-semibold text-fg">
              {names.get(clubId) ?? "Club Pro Clubs"}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

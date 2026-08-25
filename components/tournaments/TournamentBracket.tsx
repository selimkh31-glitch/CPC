import { Text, View } from "react-native";
import {
  canScheduleFirstRound,
  canShowTournamentBracket,
  MIN_CLUBS_TO_SCHEDULE,
  TOURNAMENT_COPY,
  tournamentMatchScoreLabel,
  tournamentMatchWinnerId,
  unpairedRegisteredClubIds,
} from "@/lib/tournaments";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import type { CompetitionRow, TournamentMatchRow } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";

function clubName(
  match: TournamentMatchRow,
  side: "a" | "b",
  names: Map<string, string>
): string {
  const id = side === "a" ? match.club_a_id : match.club_b_id;
  const embedded = side === "a" ? match.club_a?.name : match.club_b?.name;
  return embedded?.trim() || names.get(id) || "Club Pro Clubs";
}

/**
 * Tableau = lignes tournament_matches persistées uniquement.
 * Scores / vainqueurs = match_results liés. Unplayed → « pas encore joué ».
 */
export function TournamentBracket({
  tournament,
  matches,
  results,
  viewerId,
  isLoading,
  isError,
  onRetry,
  scheduling,
  onSchedule,
}: {
  tournament: CompetitionRow;
  matches: TournamentMatchRow[] | undefined;
  results: LinkedMatchResultRow[] | undefined;
  viewerId: string | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  scheduling?: boolean;
  onSchedule?: () => void;
}) {
  const rows = matches ?? [];
  const linked = results ?? [];
  const registeredIds = (tournament.clubs ?? []).map((row) => row.club_id);
  const names = new Map<string, string>();
  for (const row of tournament.clubs ?? []) {
    if (row.club?.name) names.set(row.club_id, row.club.name);
  }

  const scheduleGate = canScheduleFirstRound({
    actorId: viewerId ?? "",
    createdBy: tournament.created_by,
    status: tournament.status,
    kind: tournament.kind,
    registeredClubCount: registeredIds.length,
    existingMatchCount: rows.length,
  });

  if (isLoading) {
    return (
      <View>
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
          {TOURNAMENT_COPY.bracketTitle}
        </Text>
        <Skeleton className="h-16" />
      </View>
    );
  }

  if (isError) {
    return (
      <View>
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
          {TOURNAMENT_COPY.bracketTitle}
        </Text>
        <ErrorState message={TOURNAMENT_COPY.matchesLoadError} onRetry={onRetry} />
      </View>
    );
  }

  const unpaired = unpairedRegisteredClubIds(registeredIds, rows);
  const tooFewClubs = registeredIds.length < MIN_CLUBS_TO_SCHEDULE;

  return (
    <View>
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
        {TOURNAMENT_COPY.bracketTitle}
      </Text>

      {tooFewClubs ? (
        <View className="mb-3">
          <Text className="text-xs text-fg-muted">{TOURNAMENT_COPY.needTwoClubs}</Text>
          <Text className="mt-0.5 text-xs text-fg-subtle">{TOURNAMENT_COPY.cannotScheduleHint}</Text>
        </View>
      ) : null}

      {!canShowTournamentBracket(rows) && !tooFewClubs ? (
        <View className="mb-3">
          <Text className="text-xs text-fg-muted">{TOURNAMENT_COPY.bracketEmpty}</Text>
          <Text className="mt-0.5 text-xs text-fg-subtle">{TOURNAMENT_COPY.bracketEmptyHint}</Text>
        </View>
      ) : null}

      {scheduleGate.ok && onSchedule ? (
        <View className="mb-3">
          <Button loading={scheduling} onPress={onSchedule} variant="secondary">
            {TOURNAMENT_COPY.scheduleCta}
          </Button>
        </View>
      ) : null}

      {rows.length > 0
        ? groupByRound(rows).map(({ round, matches: roundMatches }) => (
            <View key={round} className="mb-3">
              <Text className="mb-1 text-xs font-bold text-fg-subtle">
                {TOURNAMENT_COPY.roundLabel} {round}
              </Text>
              <View className="gap-2">
                {roundMatches.map((match) => {
                  const score = tournamentMatchScoreLabel(match, linked);
                  const winnerId = tournamentMatchWinnerId(match, linked);
                  const nameA = clubName(match, "a", names);
                  const nameB = clubName(match, "b", names);
                  return (
                    <View key={match.id} className="rounded-xl border border-border bg-bg-elevated px-3 py-2">
                      <Text className="text-sm font-semibold text-fg">
                        {nameA} vs {nameB}
                      </Text>
                      <Text className="mt-0.5 text-xs text-fg-muted">{score}</Text>
                      {winnerId ? (
                        <Text className="mt-0.5 text-xs font-bold text-accent">
                          {TOURNAMENT_COPY.winnerLabel} · {names.get(winnerId) ?? (winnerId === match.club_a_id ? nameA : nameB)}
                        </Text>
                      ) : score !== TOURNAMENT_COPY.notPlayed ? (
                        <Text className="mt-0.5 text-xs text-fg-subtle">{TOURNAMENT_COPY.drawNoWinner}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        : null}

      {unpaired.length > 0 && rows.length > 0 ? (
        <View className="mt-1">
          <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-fg-muted">
            {TOURNAMENT_COPY.unpairedTitle}
          </Text>
          {unpaired.map((clubId) => (
            <Text key={clubId} className="text-xs text-fg-muted">
              {names.get(clubId) ?? "Club Pro Clubs"} — {TOURNAMENT_COPY.unpairedHint}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function groupByRound(matches: TournamentMatchRow[]): { round: number; matches: TournamentMatchRow[] }[] {
  const map = new Map<number, TournamentMatchRow[]>();
  for (const match of matches) {
    const list = map.get(match.round) ?? [];
    list.push(match);
    map.set(match.round, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, roundMatches]) => ({
      round,
      matches: [...roundMatches].sort((a, b) => a.slot - b.slot),
    }));
}

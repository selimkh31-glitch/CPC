import { Text, View } from "react-native";
import {
  canScheduleRound,
  canShowTournamentBracket,
  clubIdsInRound,
  latestRoundNumber,
  matchesInRound,
  MIN_CLUBS_TO_SCHEDULE,
  scheduleCtaLabel,
  TOURNAMENT_COPY,
  tournamentMatchScoreLabel,
  tournamentMatchWinnerId,
  unpairedClubIdsInRound,
} from "@/lib/tournaments";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import type { CompetitionRow, TournamentMatchRow, TournamentRoundClubRow } from "@/lib/types";
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
  roundClubs,
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
  roundClubs: TournamentRoundClubRow[] | undefined;
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
  const pool = roundClubs ?? [];
  const registeredIds = (tournament.clubs ?? []).map((row) => row.club_id);
  const names = new Map<string, string>();
  for (const row of tournament.clubs ?? []) {
    if (row.club?.name) names.set(row.club_id, row.club.name);
  }

  const scheduleGate = canScheduleRound({
    actorId: viewerId ?? "",
    createdBy: tournament.created_by,
    status: tournament.status,
    kind: tournament.kind,
    registeredClubIds: registeredIds,
    matches: rows,
    results: linked,
    roundClubs: pool,
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

  const tooFewClubs = registeredIds.length < MIN_CLUBS_TO_SCHEDULE && rows.length === 0;
  const latest = latestRoundNumber(rows);

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

      {!scheduleGate.ok &&
      viewerId === tournament.created_by &&
      (scheduleGate.reason === "round_incomplete" || scheduleGate.reason === "draw_blocks") ? (
        <Text className="mb-3 text-xs text-fg-muted">
          {scheduleGate.reason === "draw_blocks"
            ? TOURNAMENT_COPY.scheduleDrawBlocks
            : TOURNAMENT_COPY.scheduleWaitResults}
        </Text>
      ) : null}

      {scheduleGate.ok && onSchedule ? (
        <View className="mb-3">
          <Button loading={scheduling} onPress={onSchedule} variant="secondary">
            {scheduleCtaLabel(scheduleGate.intent)}
          </Button>
        </View>
      ) : null}

      {rows.length > 0
        ? (latest != null ? uniqueRounds(rows) : []).map((round) => {
            const roundMatches = matchesInRound(rows, round);
            const roundPool = clubIdsInRound(pool, round);
            const unpaired = unpairedClubIdsInRound(
              roundPool.length > 0 ? roundPool : registeredIds,
              roundMatches
            );
            return (
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
                {unpaired.length > 0 ? (
                  <View className="mt-2">
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
          })
        : null}
    </View>
  );
}

function uniqueRounds(matches: TournamentMatchRow[]): number[] {
  const set = new Set<number>();
  for (const match of matches) set.add(match.round);
  return [...set].sort((a, b) => a - b);
}

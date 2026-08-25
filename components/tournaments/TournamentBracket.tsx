import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  canScheduleRound,
  canShowTournamentBracket,
  clubIdsInRound,
  collectTournamentClubNames,
  latestRoundNumber,
  matchesInRound,
  MIN_CLUBS_TO_SCHEDULE,
  scheduleCtaLabel,
  TOURNAMENT_COPY,
  tournamentBracketRecordingClubId,
  tournamentMatchScoreLabel,
  tournamentMatchWinnerId,
  tournamentUnplayedRecordNav,
  unpairedClubIdsInRound,
} from "@/lib/tournaments";
import { competitionLinkedMatchNav } from "@/lib/competitions";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import type { CompetitionRow, TournamentMatchRow, TournamentRoundClubRow } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { TournamentClubMini } from "@/components/tournaments/TournamentClubMini";

const MINI_FLAT = "border-0 bg-transparent px-0 py-0";

/**
 * Tableau = lignes tournament_matches persistées uniquement.
 * Scores / vainqueurs = match_results liés. Unplayed → « pas encore joué ».
 * Clubs = ClubCard MINI hydratés. Tap paire PLAYED = competitionLinkedMatchNav
 * (VIEW : tournoi / compétition, jamais `/match`).
 * Paire pas encore jouée : CTA « Enregistrer le résultat » si le viewer gère
 * club_a ou club_b (pending-nav `/match`), sinon non interactif.
 */
export function TournamentBracket({
  tournament,
  matches,
  roundClubs,
  results,
  viewerId,
  managedClubIds,
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
  managedClubIds: readonly string[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  scheduling?: boolean;
  onSchedule?: () => void;
}) {
  const { mode, setMode, setSelectedManagedClubId } = useAppMode();
  const [pendingNav, setPendingNav] = useState<{ href: string; requireClubMode: boolean } | null>(null);

  useEffect(() => {
    if (!pendingNav) return;
    if (pendingNav.requireClubMode && mode !== "CLUB") return;
    router.push(pendingNav.href as any);
    setPendingNav(null);
  }, [pendingNav, mode]);

  const rows = matches ?? [];
  const linked = results ?? [];
  const pool = roundClubs ?? [];
  const registeredIds = (tournament.clubs ?? []).map((row) => row.club_id);
  const names = collectTournamentClubNames(tournament.clubs ?? [], rows);

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
                    const nameA = names.get(match.club_a_id);
                    const nameB = names.get(match.club_b_id);
                    const recordingClubId = tournamentBracketRecordingClubId(match, linked);
                    const playedNav = recordingClubId
                      ? competitionLinkedMatchNav({
                          recordingClubId,
                          managedClubIds,
                          competitionId: tournament.id,
                          kind: tournament.kind,
                        })
                      : null;
                    const recordNav = recordingClubId
                      ? null
                      : tournamentUnplayedRecordNav({
                          clubAId: match.club_a_id,
                          clubBId: match.club_b_id,
                          managedClubIds,
                        });
                    const accessibility = [nameA, nameB ? `vs ${nameB}` : null, score]
                      .filter(Boolean)
                      .join(" ");
                    const body = (
                      <>
                        <View className="flex-row items-center gap-1.5">
                          <View className="min-w-0 flex-1">
                            <TournamentClubMini
                              clubId={match.club_a_id}
                              name={nameA}
                              interactive={!playedNav}
                              className={MINI_FLAT}
                            />
                          </View>
                          <Text className="text-xs font-bold text-fg-muted">vs</Text>
                          <View className="min-w-0 flex-1">
                            <TournamentClubMini
                              clubId={match.club_b_id}
                              name={nameB}
                              interactive={!playedNav}
                              className={MINI_FLAT}
                            />
                          </View>
                        </View>
                        <Text className="mt-0.5 text-xs text-fg-muted">{score}</Text>
                        {winnerId ? (
                          <View className="mt-1">
                            <Text className="text-xs font-bold text-accent">{TOURNAMENT_COPY.winnerLabel}</Text>
                            <TournamentClubMini
                              clubId={winnerId}
                              name={names.get(winnerId)}
                              interactive={!playedNav}
                              className={MINI_FLAT}
                            />
                          </View>
                        ) : score !== TOURNAMENT_COPY.notPlayed ? (
                          <Text className="mt-0.5 text-xs text-fg-subtle">{TOURNAMENT_COPY.drawNoWinner}</Text>
                        ) : null}
                        {recordNav ? (
                          <Button
                            variant="secondary"
                            className="mt-2 min-h-[44px]"
                            accessibilityLabel={TOURNAMENT_COPY.recordResultCta}
                            onPress={() => {
                              if (recordNav.selectClubId) setSelectedManagedClubId(recordNav.selectClubId);
                              setMode("CLUB");
                              setPendingNav({ href: recordNav.href, requireClubMode: true });
                            }}
                          >
                            {TOURNAMENT_COPY.recordResultCta}
                          </Button>
                        ) : null}
                      </>
                    );
                    if (!playedNav) {
                      return (
                        <View key={match.id} className="rounded-xl border border-border bg-bg-elevated px-3 py-2">
                          {body}
                        </View>
                      );
                    }
                    return (
                      <Pressable
                        key={match.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          if (playedNav.requireClubMode) {
                            if (playedNav.selectClubId) setSelectedManagedClubId(playedNav.selectClubId);
                            setMode("CLUB");
                            setPendingNav({ href: playedNav.href, requireClubMode: true });
                            return;
                          }
                          router.push(playedNav.href as any);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={accessibility}
                        className="rounded-xl border border-border bg-bg-elevated px-3 py-2 active:opacity-80"
                      >
                        {body}
                      </Pressable>
                    );
                  })}
                </View>
                {unpaired.length > 0 ? (
                  <View className="mt-2">
                    <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-fg-muted">
                      {TOURNAMENT_COPY.unpairedTitle}
                    </Text>
                    {unpaired.map((clubId) => (
                      <View key={clubId} className="mb-1">
                        <TournamentClubMini clubId={clubId} name={names.get(clubId)} />
                        <Text className="text-xs text-fg-muted">{TOURNAMENT_COPY.unpairedHint}</Text>
                      </View>
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

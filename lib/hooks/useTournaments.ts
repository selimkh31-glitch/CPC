import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import type { TournamentCreateStatus } from "@/lib/tournaments";
import type { CompetitionClubRow, CompetitionRow, TournamentMatchRow, TournamentRoundClubRow } from "@/lib/types";

const TOURNAMENT_LIST_SELECT =
  "*, clubs:competition_clubs(*, club:clubs(id, name)), creator:users!competitions_created_by_fkey(id, username)";

const TOURNAMENT_MATCH_SELECT =
  "id, competition_id, round, slot, club_a_id, club_b_id, status, created_at, club_a:clubs!tournament_matches_club_a_fkey(id, name), club_b:clubs!tournament_matches_club_b_fkey(id, name)";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeTournament(row: CompetitionRow): CompetitionRow {
  const clubs = (row.clubs ?? []).map((item) => ({
    ...item,
    club: unwrapOne(item.club as CompetitionClubRow["club"] | CompetitionClubRow["club"][] | null) ?? undefined,
  }));
  return {
    ...row,
    kind: row.kind === "TOURNAMENT" ? "TOURNAMENT" : "COMPETITION",
    clubs,
    creator: unwrapOne(row.creator as CompetitionRow["creator"] | CompetitionRow["creator"][] | null),
  };
}

function normalizeMatch(row: TournamentMatchRow): TournamentMatchRow {
  return {
    ...row,
    club_a: unwrapOne(row.club_a as TournamentMatchRow["club_a"] | TournamentMatchRow["club_a"][] | null),
    club_b: unwrapOne(row.club_b as TournamentMatchRow["club_b"] | TournamentMatchRow["club_b"][] | null),
  };
}

function invalidateTournamentQueries(queryClient: ReturnType<typeof useQueryClient>, tournamentId?: string) {
  queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  queryClient.invalidateQueries({ queryKey: ["tournament"] });
  queryClient.invalidateQueries({ queryKey: ["tournament-matches"] });
  queryClient.invalidateQueries({ queryKey: ["competitions"] });
  queryClient.invalidateQueries({ queryKey: ["competition"] });
  queryClient.invalidateQueries({ queryKey: ["club-open-competitions"] });
  queryClient.invalidateQueries({ queryKey: ["competition-linked-results"] });
  queryClient.invalidateQueries({ queryKey: ["tournament-round-clubs"] });
  if (tournamentId) {
    queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    queryClient.invalidateQueries({ queryKey: ["tournament-matches", tournamentId] });
    queryClient.invalidateQueries({ queryKey: ["tournament-round-clubs", tournamentId] });
    queryClient.invalidateQueries({ queryKey: ["competition", tournamentId] });
  }
}

/**
 * Liste réelle (RLS) : kind=TOURNAMENT, OPEN pour tout authentifié,
 * plus les DRAFT/CLOSED du créateur. Participants = competition_clubs.
 */
export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select(TOURNAMENT_LIST_SELECT)
        .eq("kind", "TOURNAMENT")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => normalizeTournament(row as CompetitionRow));
    },
  });
}

export function useTournament(tournamentId: string | null) {
  return useQuery({
    queryKey: ["tournament", tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select(TOURNAMENT_LIST_SELECT)
        .eq("id", tournamentId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return normalizeTournament(data as CompetitionRow);
    },
  });
}

/** Paires persistées uniquement. Jamais un bracket calculé ici. */
export function useTournamentMatches(tournamentId: string | null) {
  return useQuery({
    queryKey: ["tournament-matches", tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_matches")
        .select(TOURNAMENT_MATCH_SELECT)
        .eq("competition_id", tournamentId!)
        .order("round", { ascending: true })
        .order("slot", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => normalizeMatch(row as unknown as TournamentMatchRow));
    },
  });
}

/** Pool persisté par tour (snapshot au tirage). */
export function useTournamentRoundClubs(tournamentId: string | null) {
  return useQuery({
    queryKey: ["tournament-round-clubs", tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_round_clubs")
        .select("id, competition_id, round, club_id, created_at")
        .eq("competition_id", tournamentId!)
        .order("round", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TournamentRoundClubRow[];
    },
  });
}

export function useCreateTournament(_userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; status: TournamentCreateStatus }) => {
      const { tournament } = await callEdgeFunction<{ tournament: CompetitionRow }>("create-tournament", {
        name: input.name,
        status: input.status,
      });
      return tournament;
    },
    onSuccess: (tournament) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateTournamentQueries(queryClient, tournament?.id);
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

export function useScheduleTournamentRound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tournamentId: string }) => {
      return callEdgeFunction<{
        matches: TournamentMatchRow[];
        unpairedClubIds: string[];
        round: number;
        intent: "first" | "next";
      }>("schedule-tournament-round", { tournamentId: input.tournamentId });
    },
    onSuccess: (_data, input) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateTournamentQueries(queryClient, input.tournamentId);
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

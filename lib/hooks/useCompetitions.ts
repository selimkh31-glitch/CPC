import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import type { CompetitionCreateStatus } from "@/lib/competitions";
import type { CompetitionClubRow, CompetitionRow } from "@/lib/types";

const COMPETITION_LIST_SELECT =
  "*, clubs:competition_clubs(*, club:clubs(id, name)), creator:users!competitions_created_by_fkey(id, username)";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeCompetition(row: CompetitionRow): CompetitionRow {
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

function invalidateCompetitionQueries(queryClient: ReturnType<typeof useQueryClient>, competitionId?: string) {
  queryClient.invalidateQueries({ queryKey: ["competitions"] });
  queryClient.invalidateQueries({ queryKey: ["competition"] });
  queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  queryClient.invalidateQueries({ queryKey: ["tournament"] });
  queryClient.invalidateQueries({ queryKey: ["tournament-matches"] });
  queryClient.invalidateQueries({ queryKey: ["club-open-competitions"] });
  queryClient.invalidateQueries({ queryKey: ["competition-linked-results"] });
  if (competitionId) {
    queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
    queryClient.invalidateQueries({ queryKey: ["tournament", competitionId] });
    queryClient.invalidateQueries({ queryKey: ["tournament-matches", competitionId] });
  }
}

/**
 * Liste réelle (RLS) : OPEN pour tout authentifié, plus les DRAFT/CLOSED du créateur.
 * Participants = lignes competition_clubs. Pas de classements inventés.
 */
export function useCompetitions() {
  return useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select(COMPETITION_LIST_SELECT)
        .eq("kind", "COMPETITION")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => normalizeCompetition(row as CompetitionRow));
    },
  });
}

/** Une compétition (RLS) : OPEN ou created_by = JWT. null si introuvable / non lisible. */
export function useCompetition(competitionId: string | null) {
  return useQuery({
    queryKey: ["competition", competitionId],
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select(COMPETITION_LIST_SELECT)
        .eq("id", competitionId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return normalizeCompetition(data as CompetitionRow);
    },
  });
}

export function useCreateCompetition(_userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; status: CompetitionCreateStatus }) => {
      const { competition } = await callEdgeFunction<{ competition: CompetitionRow }>("create-competition", {
        name: input.name,
        status: input.status,
      });
      return competition;
    },
    onSuccess: (competition) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateCompetitionQueries(queryClient, competition?.id);
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

export function useRegisterCompetitionClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { competitionId: string; clubId: string }) => {
      const { registration } = await callEdgeFunction<{ registration: CompetitionClubRow }>(
        "register-competition-club",
        { competitionId: input.competitionId, clubId: input.clubId }
      );
      return registration;
    },
    onSuccess: (_registration, input) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateCompetitionQueries(queryClient, input.competitionId);
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

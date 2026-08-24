import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import type { CompetitionCreateStatus } from "@/lib/competitions";
import type { CompetitionClubRow, CompetitionRow } from "@/lib/types";

const COMPETITION_LIST_SELECT =
  "*, clubs:competition_clubs(*, club:clubs(id, name))";

/**
 * Liste réelle (RLS) : OPEN pour tout authentifié, plus les DRAFT/CLOSED du créateur.
 * Pas de classements, pas de scores inventés.
 */
export function useCompetitions() {
  return useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select(COMPETITION_LIST_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CompetitionRow[];
    },
  });
}

export function useCreateCompetition(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; status: CompetitionCreateStatus }) => {
      const { competition } = await callEdgeFunction<{ competition: CompetitionRow }>("create-competition", {
        name: input.name,
        status: input.status,
      });
      return competition;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
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
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { CompetitionRow, MatchResultRow } from "@/lib/types";

/**
 * Compétitions OPEN où `clubId` est déjà inscrit. Si `opponentClubId` est
 * fourni, seulement celles où l'adverse est aussi inscrit (sinon le RPC
 * `clubs_not_in_competition` rejetterait). Pas de compétition inventée.
 */
export function useClubOpenCompetitions(clubId: string | null, opponentClubId?: string | null) {
  return useQuery({
    queryKey: ["club-open-competitions", clubId, opponentClubId ?? null],
    enabled: Boolean(clubId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_clubs")
        .select("competition:competitions(*)")
        .eq("club_id", clubId!);
      if (error) throw error;
      let competitions = (data ?? [])
        .map((row: { competition: CompetitionRow | CompetitionRow[] | null }) => {
          const competition = Array.isArray(row.competition) ? row.competition[0] : row.competition;
          return competition ?? null;
        })
        .filter((c): c is CompetitionRow => Boolean(c) && c.status === "OPEN");

      if (opponentClubId) {
        const { data: opponentRows, error: opponentError } = await supabase
          .from("competition_clubs")
          .select("competition_id")
          .eq("club_id", opponentClubId);
        if (opponentError) throw opponentError;
        const opponentSet = new Set((opponentRows ?? []).map((row: { competition_id: string }) => row.competition_id));
        competitions = competitions.filter((c) => opponentSet.has(c.id));
      }

      competitions.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      return competitions;
    },
  });
}

const LINKED_RESULT_SELECT =
  "id, club_id, opponent_club_id, competition_id, our_score, opponent_score, outcome";

export type LinkedMatchResultRow = Pick<
  MatchResultRow,
  "id" | "club_id" | "opponent_club_id" | "competition_id" | "our_score" | "opponent_score" | "outcome"
> & {
  club?: { id: string; name: string } | null;
  opponent_club?: { id: string; name: string } | null;
};

/**
 * Résultats réellement liés à une des compétitions visibles.
 * Filtre `opponent_club_id` non null — une ligne sans adverse n'alimente pas
 * un classement. Lecture RLS authenticated, pas d'INSERT client.
 */
export function useCompetitionLinkedResults(competitionIds: string[]) {
  const ids = [...competitionIds].sort();
  return useQuery({
    queryKey: ["competition-linked-results", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_results")
        .select(LINKED_RESULT_SELECT)
        .in("competition_id", ids)
        .not("opponent_club_id", "is", null);
      if (error) throw error;
      return (data ?? []) as LinkedMatchResultRow[];
    },
  });
}

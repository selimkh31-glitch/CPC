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
        .filter((c): c is CompetitionRow => c != null && c.status === "OPEN");

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
  "id, club_id, opponent_club_id, competition_id, our_score, opponent_score, outcome, created_at";

export type LinkedMatchResultRow = Pick<
  MatchResultRow,
  "id" | "club_id" | "opponent_club_id" | "competition_id" | "our_score" | "opponent_score" | "outcome" | "created_at"
> & {
  club?: { id: string; name: string } | null;
  opponent_club?: { id: string; name: string } | null;
};

async function fetchClubNames(clubIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(clubIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("clubs").select("id, name").in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
}

function withClubNames(rows: LinkedMatchResultRow[], names: Map<string, string>): LinkedMatchResultRow[] {
  return rows.map((row) => {
    const clubName = names.get(row.club_id);
    const opponentName = row.opponent_club_id ? names.get(row.opponent_club_id) : undefined;
    return {
      ...row,
      club: clubName ? { id: row.club_id, name: clubName } : row.club ?? null,
      opponent_club:
        row.opponent_club_id && opponentName
          ? { id: row.opponent_club_id, name: opponentName }
          : row.opponent_club ?? null,
    };
  });
}

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
        .not("opponent_club_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as LinkedMatchResultRow[];
      const names = await fetchClubNames(
        rows.flatMap((row) => (row.opponent_club_id ? [row.club_id, row.opponent_club_id] : [row.club_id]))
      );
      return withClubNames(rows, names);
    },
  });
}

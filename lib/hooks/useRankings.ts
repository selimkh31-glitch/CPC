import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";

const CPC_RANKING_RESULT_SELECT =
  "id, club_id, opponent_club_id, competition_id, our_score, opponent_score, outcome, created_at";

async function fetchClubNames(clubIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(clubIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("clubs").select("id, name").in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
}

/**
 * Résultats CPC avec un club adverse réel. Pas de `season_stats`, pas de
 * filtre saison (`match_results` n'a pas de `season_id`). Lecture RLS
 * authenticated, pas d'INSERT client.
 */
export function useCpcClubRankingResults() {
  return useQuery({
    queryKey: ["cpc-club-ranking-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_results")
        .select(CPC_RANKING_RESULT_SELECT)
        .not("opponent_club_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as LinkedMatchResultRow[];
      const names = await fetchClubNames(
        rows.flatMap((row) => (row.opponent_club_id ? [row.club_id, row.opponent_club_id] : [row.club_id]))
      );
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
    },
  });
}

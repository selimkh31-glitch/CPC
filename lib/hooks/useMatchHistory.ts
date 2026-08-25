import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import {
  MATCH_HISTORY_LIMIT,
  PLAYER_MATCH_HISTORY_LOOKBACK,
  buildClubMatchHistory,
  buildPlayerMatchHistory,
  countPlayerCpcMatches,
  type MatchHistoryItem,
  type MatchHistoryResultInput,
} from "@/lib/matchHistory";

export interface PlayerMatchHistoryQuery {
  items: MatchHistoryItem[];
  played: number;
}

const RESULT_COLUMNS =
  "id, match_checkin_id, club_id, opponent_club_id, our_score, opponent_score, outcome, created_at";

async function fetchClubNames(clubIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(clubIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("clubs").select("id, name").in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
}

async function fetchResultsByCheckinIds(checkinIds: string[]): Promise<MatchHistoryResultInput[]> {
  const unique = [...new Set(checkinIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("match_results")
    .select(RESULT_COLUMNS)
    .in("match_checkin_id", unique)
    .order("created_at", { ascending: false })
    .limit(PLAYER_MATCH_HISTORY_LOOKBACK);
  if (error) throw error;
  return (data ?? []) as MatchHistoryResultInput[];
}

/**
 * Historique joueur : PRESENT dans `match_participations` puis
 * `match_results` du même check-in (finalize_match persisté).
 */
export function usePlayerMatchHistory(userId: string | null) {
  return useQuery({
    queryKey: ["player-match-history", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PlayerMatchHistoryQuery> => {
      const { data: parts, error: partsError } = await supabase
        .from("match_participations")
        .select("match_checkin_id, club_id, status")
        .eq("user_id", userId!)
        .eq("status", "PRESENT")
        .order("launched_at", { referencedTable: "match_checkins", ascending: false })
        .limit(PLAYER_MATCH_HISTORY_LOOKBACK);
      if (partsError) throw partsError;

      const rows = parts ?? [];
      const checkinIds = rows.map((row: { match_checkin_id: string }) => row.match_checkin_id);
      const results = await fetchResultsByCheckinIds(checkinIds);
      const clubNames = await fetchClubNames(
        results.flatMap((row) => [row.club_id, row.opponent_club_id].filter((id): id is string => Boolean(id)))
      );
      const items = buildPlayerMatchHistory({
        participations: rows,
        results,
        clubNames,
      });
      return {
        items,
        played: countPlayerCpcMatches({ participations: rows, results }),
      };
    },
  });
}

/**
 * Historique club : `match_results.club_id` (finalize_match persisté).
 */
export function useClubMatchHistory(clubId: string | null, clubName?: string | null) {
  return useQuery({
    queryKey: ["club-match-history", clubId],
    enabled: Boolean(clubId),
    queryFn: async (): Promise<MatchHistoryItem[]> => {
      const { data, error } = await supabase
        .from("match_results")
        .select(RESULT_COLUMNS)
        .eq("club_id", clubId!)
        .order("created_at", { ascending: false })
        .limit(MATCH_HISTORY_LIMIT);
      if (error) throw error;
      const results = (data ?? []) as MatchHistoryResultInput[];
      const clubNames = await fetchClubNames(
        results.flatMap((row) => [row.club_id, row.opponent_club_id].filter((id): id is string => Boolean(id)))
      );
      return buildClubMatchHistory({
        results,
        clubId: clubId!,
        clubName: clubName ?? clubNames.get(clubId!) ?? null,
        clubNames,
      });
    },
  });
}

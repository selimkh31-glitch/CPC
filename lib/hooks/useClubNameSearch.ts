import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { filterClubsHiddenByBlock } from "@/lib/safety";
import type { ClubRow } from "@/lib/types";
import { fetchBlockedUserIdSet } from "@/lib/hooks/useSafety";

const CLUB_SEARCH_MIN = 2;

/**
 * Recherche de clubs CPC réels par nom (ilike). Pas de seed, pas de nom libre.
 * `excludeClubId` = le club qui enregistre le résultat (jamais soi-même).
 * Même règle LIVE / matching : un club dont le owner est bloqué (les deux
 * sens) n'est pas proposé comme adversaire.
 */
export function useClubNameSearch(query: string, excludeClubId: string | null) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["club-name-search", trimmed, excludeClubId],
    enabled: trimmed.length >= CLUB_SEARCH_MIN,
    queryFn: async () => {
      let request = supabase
        .from("clubs")
        .select("id, name, level, owner_id")
        .ilike("name", `%${trimmed}%`)
        .order("name", { ascending: true })
        .limit(20);
      if (excludeClubId) request = request.neq("id", excludeClubId);
      const { data, error } = await request;
      if (error) throw error;
      let blocked: Set<string>;
      try {
        blocked = await fetchBlockedUserIdSet();
      } catch {
        blocked = new Set();
      }
      const rows = (data ?? []) as Pick<ClubRow, "id" | "name" | "level" | "owner_id">[];
      return filterClubsHiddenByBlock(rows, blocked).map(({ id, name, level }) => ({ id, name, level }));
    },
  });
}

export const CLUB_NAME_SEARCH_MIN = CLUB_SEARCH_MIN;

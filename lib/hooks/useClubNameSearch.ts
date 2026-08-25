import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { ClubRow } from "@/lib/types";

const CLUB_SEARCH_MIN = 2;

/**
 * Recherche de clubs CPC réels par nom (ilike). Pas de seed, pas de nom libre.
 * `excludeClubId` = le club qui enregistre le résultat (jamais soi-même).
 */
export function useClubNameSearch(query: string, excludeClubId: string | null) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["club-name-search", trimmed, excludeClubId],
    enabled: trimmed.length >= CLUB_SEARCH_MIN,
    queryFn: async () => {
      let request = supabase
        .from("clubs")
        .select("id, name, level")
        .ilike("name", `%${trimmed}%`)
        .order("name", { ascending: true })
        .limit(20);
      if (excludeClubId) request = request.neq("id", excludeClubId);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as Pick<ClubRow, "id" | "name" | "level">[];
    },
  });
}

export const CLUB_NAME_SEARCH_MIN = CLUB_SEARCH_MIN;

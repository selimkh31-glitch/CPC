import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export interface CurrentClubRef {
  id: string;
  name: string;
}

/**
 * Club actuel par joueur (première adhésion `joined_at`). Pas un free-agent
 * inventé : absence de ligne → pas de club affiché.
 */
export function useCurrentClubsByUserIds(userIds: readonly string[]) {
  const unique = [...new Set(userIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["current-clubs-by-user", unique.join(",")],
    enabled: unique.length > 0,
    queryFn: async (): Promise<Map<string, CurrentClubRef>> => {
      const { data, error } = await supabase
        .from("club_members")
        .select("user_id, joined_at, club:clubs(id, name)")
        .in("user_id", unique)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      const map = new Map<string, CurrentClubRef>();
      for (const row of data ?? []) {
        const userId = (row as { user_id: string }).user_id;
        if (map.has(userId)) continue;
        const club = (row as { club: { id: string; name: string } | { id: string; name: string }[] | null }).club;
        const resolved = Array.isArray(club) ? club[0] : club;
        if (!resolved?.id || !resolved.name?.trim()) continue;
        map.set(userId, { id: resolved.id, name: resolved.name.trim() });
      }
      return map;
    },
  });
}

export function useCurrentClubForUser(userId: string | null) {
  const query = useCurrentClubsByUserIds(userId ? [userId] : []);
  return {
    ...query,
    data: userId ? query.data?.get(userId) ?? null : null,
  };
}

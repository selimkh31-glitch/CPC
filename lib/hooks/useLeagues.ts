import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { SeasonRow, SeasonStatRow } from "@/lib/types";

/** Ligues & Saisons — classements (section 3.F). */
export function useActiveSeason() {
  return useQuery({
    queryKey: ["active-season"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seasons").select("*").eq("is_active", true).maybeSingle();
      if (error) throw error;
      return data as SeasonRow | null;
    },
  });
}

export function useSeasonStats(seasonId: string | null) {
  return useQuery({
    queryKey: ["season-stats", seasonId],
    enabled: Boolean(seasonId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("season_stats")
        .select("*, user:users(username, platform)")
        .eq("season_id", seasonId!)
        .order("points", { ascending: false });
      if (error) throw error;
      return data as SeasonStatRow[];
    },
  });
}

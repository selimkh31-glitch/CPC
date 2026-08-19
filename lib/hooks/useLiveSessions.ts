import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Fil temps réel des sessions live (section 3.C / 8). Charge l'état initial
 * via React Query puis invalide le cache sur chaque changement Postgres
 * (Supabase Realtime) pour que le feed réagisse sans pull-to-refresh.
 */
export function useLiveSessions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["live-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_sessions")
        .select("*, club:clubs(id,name,level,languages)")
        .eq("is_live", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ClubSessionRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("live-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "club_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

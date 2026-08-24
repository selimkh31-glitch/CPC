import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { isLiveActive } from "@/lib/live";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Fil temps réel des sessions LIVE club (recrutement FC 27 Pro Clubs).
 * Filtre `is_live` + `expires_at > now` côté requête, puis `isLiveActive`
 * côté client (horloge locale) pour ne jamais afficher un LIVE déjà expiré
 * si le cron n'a pas encore basculé `is_live`.
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
        .gt("expires_at", new Date().toISOString())
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      return (data as ClubSessionRow[]).filter((row) => isLiveActive(row, now));
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

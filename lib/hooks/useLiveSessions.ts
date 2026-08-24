import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { isLiveActive } from "@/lib/live";
import { invokeExpireStaleLiveSessions } from "@/lib/liveJanitor";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Fil LIVE club. Janitor RPC en tête de fetch (même sans cron) puis filtre
 * is_live + expires_at côté SQL et isLiveActive côté client.
 * refetchInterval : un LIVE qui expire pendant que l'écran est ouvert disparaît.
 */
export function useLiveSessions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["live-sessions"],
    refetchInterval: 15_000,
    queryFn: async () => {
      await invokeExpireStaleLiveSessions();
      const { data, error } = await supabase
        .from("club_sessions")
        .select("*, club:clubs(id,name,level,languages,owner:users(platform,username))")
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

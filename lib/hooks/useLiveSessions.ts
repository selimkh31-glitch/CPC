import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { isLiveActive } from "@/lib/live";
import { invokeExpireStaleLiveSessions } from "@/lib/liveJanitor";
import { fetchBlockedUserIdSet } from "@/lib/hooks/useSafety";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Fil LIVE club. Janitor RPC en tête de fetch (même sans cron) puis filtre
 * is_live + expires_at côté SQL et isLiveActive côté client.
 * refetchInterval : un LIVE qui expire pendant que l'écran est ouvert disparaît.
 */
const liveFeedChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<() => void>; refCount: number }
>();

function acquireLiveFeedChannel() {
  const topic = "live-feed";
  let entry = liveFeedChannels.get(topic);
  if (!entry) {
    const listeners = new Set<() => void>();
    const channel = supabase
      .channel(topic)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_sessions" }, () => {
        listeners.forEach((listener) => listener());
      })
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    liveFeedChannels.set(topic, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseLiveFeedChannel(listener: () => void) {
  const topic = "live-feed";
  const entry = liveFeedChannels.get(topic);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    liveFeedChannels.delete(topic);
  }
}

export function useLiveSessions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["live-sessions"],
    refetchInterval: 15_000,
    queryFn: async () => {
      await invokeExpireStaleLiveSessions();
      const { data, error } = await supabase
        .from("club_sessions")
        .select("*, club:clubs(id,name,level,languages,owner_id, owner:users(id,platform,username))")
        .eq("is_live", true)
        .gt("expires_at", new Date().toISOString())
        .not("needed_positions", "eq", "{}")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      let blocked: Set<string>;
      try {
        blocked = await fetchBlockedUserIdSet();
      } catch {
        blocked = new Set();
      }
      return (data as ClubSessionRow[]).filter(
        (row) =>
          isLiveActive(row, now) &&
          (row.needed_positions?.length ?? 0) > 0 &&
          !blocked.has(row.club?.owner_id ?? "") &&
          !blocked.has(row.club?.owner?.id ?? "")
      );
    },
  });

  useEffect(() => {
    const listener = () => queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
    const entry = acquireLiveFeedChannel();
    entry.listeners.add(listener);
    return () => releaseLiveFeedChannel(listener);
  }, [queryClient]);

  return query;
}

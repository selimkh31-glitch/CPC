import { useEffect } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { isLiveActive } from "@/lib/live";
import { invokeExpireStaleLiveSessions } from "@/lib/liveJanitor";
import { isClubHiddenByBlock } from "@/lib/safety";
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
    placeholderData: keepPreviousData,
    queryFn: async () => {
      await invokeExpireStaleLiveSessions();
      const { data, error } = await supabase
        .from("club_sessions")
        .select("*")
        .eq("is_live", true)
        .gt("expires_at", new Date().toISOString())
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as ClubSessionRow[];
      const clubIds = [...new Set(rows.map((row) => row.club_id).filter(Boolean))];
      const clubsById = new Map<string, NonNullable<ClubSessionRow["club"]>>();
      if (clubIds.length > 0) {
        const nested = await supabase
          .from("clubs")
          .select("id,name,level,languages,owner_id, owner:users!clubs_owner_id_fkey(id,platform,username)")
          .in("id", clubIds);
        const clubRows = nested.error
          ? (
              await supabase.from("clubs").select("id,name,level,languages,owner_id").in("id", clubIds)
            ).data
          : nested.data;
        for (const club of (clubRows ?? []) as NonNullable<ClubSessionRow["club"]>[]) {
          clubsById.set(club.id, club);
        }
      }
      const now = Date.now();
      let blocked: Set<string>;
      try {
        blocked = await fetchBlockedUserIdSet();
      } catch {
        blocked = new Set();
      }
      return rows
        .map((row) => ({ ...row, club: clubsById.get(row.club_id) ?? row.club }))
        .filter(
          (row) =>
            isLiveActive(row, now) &&
            (row.needed_positions?.length ?? 0) > 0 &&
            Boolean(row.club) &&
            !isClubHiddenByBlock(row.club, blocked)
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

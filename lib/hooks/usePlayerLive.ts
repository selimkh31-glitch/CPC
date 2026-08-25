import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { computeLiveExpiresAt, isLiveActive, parseLiveDurationMs } from "@/lib/live";
import { invokeExpireStaleLiveSessions } from "@/lib/liveJanitor";
import { USER_PUBLIC_COLUMNS, type PlayerSessionRow } from "@/lib/types";
import { fetchBlockedUserIdSet } from "@/lib/hooks/useSafety";

function invalidatePlayerLive(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["live-players"] });
  queryClient.invalidateQueries({ queryKey: ["my-player-session"] });
}

const livePlayerChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<() => void>; refCount: number }
>();

function acquireLivePlayersChannel() {
  const topic = "live-players";
  let entry = livePlayerChannels.get(topic);
  if (!entry) {
    const listeners = new Set<() => void>();
    const channel = supabase
      .channel(topic)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_sessions" }, () => {
        listeners.forEach((listener) => listener());
      })
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    livePlayerChannels.set(topic, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseLivePlayersChannel(listener: () => void) {
  const topic = "live-players";
  const entry = livePlayerChannels.get(topic);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    livePlayerChannels.delete(topic);
  }
}

const myPlayerSessionChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<() => void>; refCount: number }
>();

function acquireMyPlayerSessionChannel(userId: string) {
  const topic = `my-player-session-${userId}`;
  let entry = myPlayerSessionChannels.get(topic);
  if (!entry) {
    const listeners = new Set<() => void>();
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_sessions", filter: `user_id=eq.${userId}` },
        () => listeners.forEach((listener) => listener())
      )
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    myPlayerSessionChannels.set(topic, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseMyPlayerSessionChannel(userId: string, listener: () => void) {
  const topic = `my-player-session-${userId}`;
  const entry = myPlayerSessionChannels.get(topic);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    myPlayerSessionChannels.delete(topic);
  }
}

/** Session LIVE du joueur connecté (la plus récente, active ou non). */
export function useMyPlayerSession(userId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-player-session", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_sessions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as PlayerSessionRow | null) ?? null;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const listener = () => queryClient.invalidateQueries({ queryKey: ["my-player-session", userId] });
    const entry = acquireMyPlayerSessionChannel(userId);
    entry.listeners.add(listener);
    return () => releaseMyPlayerSessionChannel(userId, listener);
  }, [userId, queryClient]);

  return query;
}

/** Joueurs actuellement LIVE (discovery recrutement). */
export function useLivePlayers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["live-players"],
    refetchInterval: 15_000,
    queryFn: async () => {
      await invokeExpireStaleLiveSessions();
      const { data, error } = await supabase
        .from("player_sessions")
        .select(`*, user:users(${USER_PUBLIC_COLUMNS})`)
        .eq("is_live", true)
        .gt("expires_at", new Date().toISOString())
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      let blocked: Set<string>;
      try {
        blocked = await fetchBlockedUserIdSet();
      } catch {
        blocked = new Set();
      }
      return (data as PlayerSessionRow[]).filter(
        (row) => isLiveActive(row, now) && row.user && !blocked.has(row.user_id)
      );
    },
  });

  useEffect(() => {
    const listener = () => queryClient.invalidateQueries({ queryKey: ["live-players"] });
    const entry = acquireLivePlayersChannel();
    entry.listeners.add(listener);
    return () => releaseLivePlayersChannel(listener);
  }, [queryClient]);

  return query;
}

export function useGoPlayerLive(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { note?: string; durationMs?: number }) => {
      if (!userId) throw new Error("Non authentifié");
      const durationMs = parseLiveDurationMs(input.durationMs !== undefined ? String(input.durationMs) : undefined);
      const expiresAt = computeLiveExpiresAt(Date.now(), durationMs).toISOString();
      await supabase.from("player_sessions").update({ is_live: false }).eq("user_id", userId).eq("is_live", true);
      const { data, error } = await supabase
        .from("player_sessions")
        .insert({
          user_id: userId,
          is_live: true,
          note: input.note ?? null,
          expires_at: expiresAt,
        })
        .select()
        .single();
      if (error?.code === "23505") {
        await supabase.from("player_sessions").update({ is_live: false }).eq("user_id", userId).eq("is_live", true);
        const retry = await supabase
          .from("player_sessions")
          .insert({
            user_id: userId,
            is_live: true,
            note: input.note ?? null,
            expires_at: expiresAt,
          })
          .select()
          .single();
        if (retry.error) throw retry.error;
        return retry.data as PlayerSessionRow;
      }
      if (error) throw error;
      return data as PlayerSessionRow;
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      invalidatePlayerLive(queryClient);
    },
  });
}

/** Coupe LIVE — uniquement le bouton Arrêter, jamais unmount / signOut / switch. */
export function useGoPlayerOffline(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!userId) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("player_sessions")
        .update({ is_live: false })
        .eq("id", sessionId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      invalidatePlayerLive(queryClient);
    },
  });
}

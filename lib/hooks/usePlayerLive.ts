import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { computeLiveExpiresAt, isLiveActive, parseLiveDurationMs } from "@/lib/live";
import { invokeExpireStaleLiveSessions } from "@/lib/liveJanitor";
import { USER_PUBLIC_COLUMNS, type PlayerSessionRow } from "@/lib/types";

function invalidatePlayerLive(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["live-players"] });
  queryClient.invalidateQueries({ queryKey: ["my-player-session"] });
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
    const channel = supabase
      .channel(`my-player-session-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_sessions", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["my-player-session", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
      return (data as PlayerSessionRow[]).filter((row) => isLiveActive(row, now) && row.user);
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("live-players")
      .on("postgres_changes", { event: "*", schema: "public", table: "player_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-players"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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

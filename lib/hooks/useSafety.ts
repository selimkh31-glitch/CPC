import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import { USER_PUBLIC_COLUMNS, type UserBlockRow, type UserReportRow } from "@/lib/types";
import type { ReportReason } from "@/lib/safety";

export async function fetchBlockedUserIdSet(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("my_blocked_user_ids");
  if (error) throw error;
  return new Set((data as string[] | null) ?? []);
}

function invalidateAfterBlockChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["blocked-user-ids"] });
  queryClient.invalidateQueries({ queryKey: ["my-blocks"] });
  queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
  queryClient.invalidateQueries({ queryKey: ["live-players"] });
  queryClient.invalidateQueries({ queryKey: ["player-search"] });
  queryClient.invalidateQueries({ queryKey: ["invitable-club-players"] });
  queryClient.invalidateQueries({ queryKey: ["club-search"] });
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
  queryClient.invalidateQueries({ queryKey: ["applications"] });
  queryClient.invalidateQueries({ queryKey: ["club-invitations"] });
  queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
  queryClient.invalidateQueries({ queryKey: ["my-applications"] });
}

const blockChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<() => void>; refCount: number }
>();

function acquireBlocksChannel(userId: string) {
  let entry = blockChannels.get(userId);
  if (!entry) {
    const listeners = new Set<() => void>();
    const channel = supabase
      .channel(`user-blocks-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_blocks" }, () => {
        listeners.forEach((listener) => listener());
      })
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    blockChannels.set(userId, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseBlocksChannel(userId: string, listener: () => void) {
  const entry = blockChannels.get(userId);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    blockChannels.delete(userId);
  }
}

/** Ids bloqués dans les deux sens. Realtime → invalidation discovery / chat. */
export function useBlockedUserIds(userId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["blocked-user-ids", userId],
    enabled: Boolean(userId),
    queryFn: async () => [...(await fetchBlockedUserIdSet())],
  });

  useEffect(() => {
    if (!userId) return;
    const listener = () => invalidateAfterBlockChange(queryClient);
    const entry = acquireBlocksChannel(userId);
    entry.listeners.add(listener);
    return () => releaseBlocksChannel(userId, listener);
  }, [userId, queryClient]);

  return query;
}

/** Personnes que J'ai bloquées (liste + unblock). */
export function useMyBlocks(userId: string | null) {
  return useQuery({
    queryKey: ["my-blocks", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_blocks")
        .select(`*, blocked:users!user_blocks_blocked_id_fkey(${USER_PUBLIC_COLUMNS})`)
        .eq("blocker_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserBlockRow[];
    },
  });
}

export function useMyReports(userId: string | null) {
  return useQuery({
    queryKey: ["my-reports", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_reports")
        .select(`*, reported:users!user_reports_reported_id_fkey(id,username)`)
        .eq("reporter_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserReportRow[];
    },
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => callEdgeFunction("block-user", { userId }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateAfterBlockChange(queryClient);
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => callEdgeFunction("unblock-user", { userId }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateAfterBlockChange(queryClient);
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

export function useReportUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; reason: ReportReason; details?: string }) =>
      callEdgeFunction("report-user", input),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

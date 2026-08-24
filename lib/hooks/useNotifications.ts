import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { NotificationRow } from "@/lib/types";

const notificationChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<() => void>; refCount: number }
>();

function acquireNotificationsChannel(userId: string) {
  let entry = notificationChannels.get(userId);
  if (!entry) {
    const listeners = new Set<() => void>();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => listeners.forEach((listener) => listener())
      )
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    notificationChannels.set(userId, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseNotificationsChannel(userId: string, listener: () => void) {
  const entry = notificationChannels.get(userId);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    notificationChannels.delete(userId);
  }
}

export function useNotifications(userId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data as NotificationRow[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const listener = () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    const entry = acquireNotificationsChannel(userId);
    entry.listeners.add(listener);
    return () => releaseNotificationsChannel(userId, listener);
  }, [userId, queryClient]);

  return query;
}

export function useUnreadNotificationCount(userId: string | null) {
  const { data } = useNotifications(userId);
  return (data ?? []).filter((n) => !n.read_at).length;
}

export function useMarkNotificationRead(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId!)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
}

export function useMarkAllNotificationsRead(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
}

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unreadNotificationCount, withAllNotificationsRead } from "@/lib/notificationRead";
import { supabase } from "@/lib/supabase/client";
import type { NotificationRow } from "@/lib/types";

export const notificationsQueryKey = (userId: string | null) => ["notifications", userId] as const;

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
    queryKey: notificationsQueryKey(userId),
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
    const listener = () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
    const entry = acquireNotificationsChannel(userId);
    entry.listeners.add(listener);
    return () => releaseNotificationsChannel(userId, listener);
  }, [userId, queryClient]);

  return query;
}

export function useUnreadNotificationCount(userId: string | null) {
  const { data } = useNotifications(userId);
  return unreadNotificationCount(data ?? []);
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
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
    },
  });
}

/**
 * Pose `read_at` sur toutes les non-lues du user courant.
 * Pas de RPC dédié (0025 n'en a pas) — UPDATE colonne `read_at` via RLS
 * `notifications_update_read_own` (ses lignes uniquement, grant restreint).
 */
export function useMarkAllNotificationsRead(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Non authentifié");
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
      return readAt;
    },
    onSuccess: (readAt) => {
      queryClient.setQueryData<NotificationRow[]>(notificationsQueryKey(userId), (prev) =>
        prev ? withAllNotificationsRead(prev, readAt) : prev
      );
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
    },
  });
}

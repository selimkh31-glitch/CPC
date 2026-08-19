import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import type { ApplicationRow } from "@/lib/types";

/**
 * Registre module-level des canaux `applications-${clubId}` — même nécessité
 * que `myDepartureChannels`/`clubDeparturesChannels` (lib/hooks/useDepartures.ts,
 * hotfix G.3.2.1) : depuis G.3.2, `useApplications` est monté à la fois par
 * MatchContextCards (Match Day Cockpit, tab MATCH — reste monté en
 * arrière-plan par le tab navigator Expo Router) ET par ApplicationsPanel
 * (tab CANDIDATURES), pour le même clubId, potentiellement en même temps.
 * `supabase.channel(topic)` réutilise l'instance existante pour un topic déjà
 * connu du client Realtime : un second `.on(...)` sur ce même canal, une fois
 * `.subscribe()` déjà passé côté premier mount, fait planter Realtime
 * ("cannot add postgres_changes callbacks ... after subscribe()"). Un seul
 * canal réel par clubId est donc créé ici (un seul `.on()` avant l'unique
 * `.subscribe()`), partagé par référence-comptage entre tous les hooks
 * montés ; chaque mount ajoute juste son propre listener dans un Set.
 */
const applicationsChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<(payload: any) => void>; refCount: number }
>();

function acquireApplicationsChannel(clubId: string) {
  let entry = applicationsChannels.get(clubId);
  if (!entry) {
    const listeners = new Set<(payload: any) => void>();
    const channel = supabase
      .channel(`applications-${clubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `club_id=eq.${clubId}` },
        (payload) => listeners.forEach((listener) => listener(payload))
      )
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    applicationsChannels.set(clubId, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseApplicationsChannel(clubId: string, listener: (payload: any) => void) {
  const entry = applicationsChannels.get(clubId);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    applicationsChannels.delete(clubId);
  }
}

/** Candidatures entrantes d'un club en temps réel, triées fiabilité d'abord (section 3.B/D/E). Alimente ApplicationsPanel ET MatchContextCards. */
export function useApplications(clubId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["applications", clubId],
    enabled: Boolean(clubId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, user:users(id,username,reliability_score,platform)")
        .eq("club_id", clubId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data as ApplicationRow[];
      return rows.sort((a, b) => {
        if (a.status !== "PENDING" || b.status !== "PENDING") return 0;
        return (b.user?.reliability_score ?? 0) - (a.user?.reliability_score ?? 0);
      });
    },
  });

  useEffect(() => {
    if (!clubId) return;

    const listener = () => queryClient.invalidateQueries({ queryKey: ["applications", clubId] });
    const entry = acquireApplicationsChannel(clubId);
    entry.listeners.add(listener);

    return () => {
      releaseApplicationsChannel(clubId, listener);
    };
  }, [clubId, queryClient]);

  return query;
}

export function useRespondApplication(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { applicationId: string; status: "ACCEPTED" | "REJECTED" }) =>
      callEdgeFunction("respond-application", vars),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["applications", clubId] });
    },
  });
}

/** Candidatures du joueur connecté, tous statuts confondus (écran "Mes candidatures"). */
export function useMyApplications(userId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-applications", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, club:clubs(id,name,level)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ApplicationRow[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`my-applications-list-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["my-applications", userId] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}

/** Retrait d'une candidature PENDING par son propriétaire (historique conservé, voir RLS "applications_withdraw_self"). */
export function useWithdrawApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { data, error } = await supabase
        .from("applications")
        .update({ status: "WITHDRAWN" })
        .eq("id", applicationId)
        .select()
        .single();
      if (error) throw error;
      return data as ApplicationRow;
    },
    onSuccess: (_, applicationId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });
}

/** Notifie l'écran en temps réel quand le statut d'une candidature du user change (haptics + refetch). */
export function useMyApplicationStatusUpdates(userId: string | null, onChange: (status: string) => void) {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`my-applications-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "applications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const status = (payload.new as { status: string }).status;
          Haptics.notificationAsync(
            status === "ACCEPTED" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
          );
          onChange(status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onChange]);
}

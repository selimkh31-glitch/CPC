import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import { USER_PUBLIC_COLUMNS, type ApplicationRow } from "@/lib/types";

type RealtimePayloadListener = (payload: any) => void;

export type SharedChannelEntry = {
  channel: ReturnType<typeof supabase.channel>;
  listeners: Set<RealtimePayloadListener>;
  refCount: number;
};

type SharedChannelRegistry = Map<string, SharedChannelEntry>;

/** Topic leftover from a previous subscribe — `foo`, `realtime:foo`, or `*:foo`. */
export function isLeftoverRealtimeTopic(channelTopic: string, topic: string): boolean {
  return channelTopic === topic || channelTopic === `realtime:${topic}` || channelTopic.endsWith(`:${topic}`);
}

/**
 * Retire tout canal déjà connu du client Realtime pour ce topic, sinon
 * `supabase.channel(topic)` réutilise l'instance et un second `.on()` après
 * `.subscribe()` plante : "cannot add postgres_changes callbacks ... after subscribe()".
 */
export function dropLeftoverChannel(topic: string) {
  for (const ch of [...supabase.getChannels()]) {
    const t = typeof (ch as { topic?: string }).topic === "string" ? (ch as { topic: string }).topic : "";
    if (isLeftoverRealtimeTopic(t, topic)) supabase.removeChannel(ch);
  }
}

export function acquireSharedChannel(
  registry: SharedChannelRegistry,
  key: string,
  topic: string,
  table: string,
  filter: string
): SharedChannelEntry {
  let entry = registry.get(key);
  if (!entry) {
    dropLeftoverChannel(topic);
    const listeners = new Set<RealtimePayloadListener>();
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        (payload) => listeners.forEach((listener) => listener(payload))
      )
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    registry.set(key, entry);
  }
  entry.refCount += 1;
  return entry;
}

export function releaseSharedChannel(
  registry: SharedChannelRegistry,
  key: string,
  listener: RealtimePayloadListener
) {
  const entry = registry.get(key);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    registry.delete(key);
  }
}

/**
 * Registre module-level des canaux `applications-${clubId}` — même nécessité
 * que `myDepartureChannels`/`clubDeparturesChannels` (lib/hooks/useDepartures.ts,
 * hotfix G.3.2.1) : depuis G.3.2, `useApplications` est monté à la fois par
 * MatchContextCards (Match Day Cockpit, tab MATCH — reste monté en
 * arrière-plan par le tab navigator Expo Router) ET par ApplicationsPanel
 * (tab CANDIDATURES), pour le même clubId, potentiellement en même temps.
 * Un seul canal réel par clubId (un seul `.on()` avant l'unique `.subscribe()`).
 */
const applicationsChannels: SharedChannelRegistry = new Map();

/**
 * HomeScreen (Accueil / Club) ET MyApplicationsList (Activité) montent
 * `useMyApplications` pour le même userId — même crash si chacun
 * `.channel().on().subscribe()`.
 */
const myApplicationsListChannels: SharedChannelRegistry = new Map();

/** `useMyApplicationStatusUpdates` — topic `my-applications-${userId}`. */
const myApplicationStatusChannels: SharedChannelRegistry = new Map();

function acquireApplicationsChannel(clubId: string) {
  return acquireSharedChannel(
    applicationsChannels,
    clubId,
    `applications-${clubId}`,
    "applications",
    `club_id=eq.${clubId}`
  );
}

function releaseApplicationsChannel(clubId: string, listener: RealtimePayloadListener) {
  releaseSharedChannel(applicationsChannels, clubId, listener);
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
        .select(`*, user:users(${USER_PUBLIC_COLUMNS})`)
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
    mutationFn: (vars: { applicationId: string; status: "ACCEPTED" | "DECLINED" | "REJECTED" }) =>
      callEdgeFunction("respond-application", {
        applicationId: vars.applicationId,
        status: vars.status === "REJECTED" ? "DECLINED" : vars.status,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["applications", clubId] });
      // accept_application() insère club_members — l'effectif (["club", clubId])
      // doit refléter le nouveau membre sans attendre un refetch au focus.
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
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
    const listener = () => queryClient.invalidateQueries({ queryKey: ["my-applications", userId] });
    const entry = acquireSharedChannel(
      myApplicationsListChannels,
      userId,
      `my-applications-list-${userId}`,
      "applications",
      `user_id=eq.${userId}`
    );
    entry.listeners.add(listener);

    return () => {
      releaseSharedChannel(myApplicationsListChannels, userId, listener);
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
        .eq("status", "PENDING")
        .select()
        .single();
      if (error) throw new Error("Cette candidature a déjà été traitée.");
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
    const listener = (payload: any) => {
      const status = (payload?.new as { status?: string } | undefined)?.status;
      if (!status) return;
      Haptics.notificationAsync(
        status === "ACCEPTED" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );
      onChange(status);
    };
    const entry = acquireSharedChannel(
      myApplicationStatusChannels,
      userId,
      `my-applications-${userId}`,
      "applications",
      `user_id=eq.${userId}`
    );
    entry.listeners.add(listener);

    return () => {
      releaseSharedChannel(myApplicationStatusChannels, userId, listener);
    };
  }, [userId, onChange]);
}

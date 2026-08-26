import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import { USER_PUBLIC_COLUMNS, type ClubDepartureRow, type DepartureStatus } from "@/lib/types";

/**
 * Phase 5, Étape 4 — hooks départs. Toute écriture passe exclusivement par
 * les Edge Functions (request-departure/respond-departure/release-member,
 * déjà déployées) : aucun de ces hooks ne fait de supabase.from(...).insert/
 * update/delete sur club_departures, club_members (au-delà de `role`, déjà
 * légitime), slot_assignments ou les compteurs matches_played_count/
 * strike_count/active_departure_request_id. Les seules lectures directes
 * (useDeparture, useClubDepartures) sont des SELECT, protégés par les RLS
 * existantes (club_departures_select_involved).
 */

/** Une demande de départ précise, par id — alimente la carte joueur (statut courant). */
export function useDeparture(departureId: string | null) {
  return useQuery({
    queryKey: ["departure", departureId],
    enabled: Boolean(departureId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_departures")
        .select(
          `*, user:users(${USER_PUBLIC_COLUMNS}), transition_target_club:clubs!club_departures_transition_target_club_id_fkey(name)`
        )
        .eq("id", departureId!)
        .single();
      if (error) throw error;
      return data as ClubDepartureRow;
    },
  });
}

/** Demande de départ du joueur connecté — request-departure (serveur = seule source de vérité sur l'éligibilité). */
export function useRequestDeparture(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      callEdgeFunction<{ departure: ClubDepartureRow; leftImmediately?: boolean }>("request-departure", { clubId }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

/**
 * Registre module-level des canaux `club-departures-${clubId}` — même
 * nécessité que `myDepartureChannels` plus bas : depuis G.3.2, `useClubDepartures`
 * est monté à la fois par MatchContextCards (Match Day Cockpit, sur le tab
 * MATCH — qui reste monté en arrière-plan par le tab navigator Expo Router)
 * ET par DeparturesPanel (tab EFFECTIF), pour le même clubId, potentiellement
 * en même temps. `supabase.channel(topic)` réutilise l'instance existante
 * pour un topic déjà connu du client Realtime : un second `.on(...)` sur ce
 * même canal, une fois `.subscribe()` déjà passé côté premier mount, fait
 * planter Realtime ("cannot add postgres_changes callbacks ... after
 * subscribe()") — c'est le crash exact observé MATCH -> EFFECTIF (hotfix
 * G.3.2.1). Un seul canal réel par clubId est donc créé ici (un seul `.on()`
 * avant l'unique `.subscribe()`), partagé par référence-comptage entre tous
 * les hooks montés ; chaque mount ajoute juste son propre listener dans un
 * Set, invoqué à chaque événement. Même canal, même callback métier, aucun
 * nouveau système realtime.
 */
const clubDeparturesChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<(payload: any) => void>; refCount: number }
>();

function acquireClubDeparturesChannel(clubId: string) {
  let entry = clubDeparturesChannels.get(clubId);
  if (!entry) {
    const listeners = new Set<(payload: any) => void>();
    const channel = supabase
      .channel(`club-departures-${clubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_departures", filter: `club_id=eq.${clubId}` },
        (payload) => listeners.forEach((listener) => listener(payload))
      )
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    clubDeparturesChannels.set(clubId, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseClubDeparturesChannel(clubId: string, listener: (payload: any) => void) {
  const entry = clubDeparturesChannels.get(clubId);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    clubDeparturesChannels.delete(clubId);
  }
}

/** Demandes PENDING d'un club, temps réel — alimente DeparturesPanel (owner/manager) ET MatchContextCards, pattern identique à useApplications. */
export function useClubDepartures(clubId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["club-departures", clubId],
    enabled: Boolean(clubId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_departures")
        .select(`*, user:users(${USER_PUBLIC_COLUMNS})`)
        .eq("club_id", clubId!)
        .eq("status", "PENDING")
        .order("requested_at", { ascending: true });
      if (error) throw error;
      return data as ClubDepartureRow[];
    },
  });

  useEffect(() => {
    if (!clubId) return;

    const listener = () => queryClient.invalidateQueries({ queryKey: ["club-departures", clubId] });
    const entry = acquireClubDeparturesChannel(clubId);
    entry.listeners.add(listener);

    return () => {
      releaseClubDeparturesChannel(clubId, listener);
    };
  }, [clubId, queryClient]);

  return query;
}

/** Réponse owner/manager (NOW/NEXT_MATCH/REFUSE) — respond-departure, compteur de strikes unifié géré côté serveur. */
export function useRespondDeparture(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { departureId: string; decision: "NOW" | "NEXT_MATCH" | "REFUSE" }) =>
      callEdgeFunction<{ departure: ClubDepartureRow }>("respond-departure", {
        departureId: input.departureId,
        decision: input.decision,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["club-departures", clubId] });
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
    },
  });
}

/** Libération d'un membre par owner/manager — release-member (jamais de delete direct club_members côté client). */
export function useReleaseMember(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      callEdgeFunction<{ departure: ClubDepartureRow }>("release-member", { clubId, userId }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      queryClient.invalidateQueries({ queryKey: ["club-departures", clubId] });
    },
  });
}

/**
 * Registre module-level des canaux `my-departures-${userId}` — plusieurs
 * écrans montent `useMyDepartureUpdates` pour le même userId en même temps
 * (clubs.tsx reste monté en arrière-plan par le tab navigator pendant que
 * MyDepartureStatusCard est affiché sur match-sheet). `supabase.channel(topic)`
 * réutilise l'instance existante pour un topic déjà connu du client réaltime :
 * un second appel à `.on(...)` sur ce même canal, une fois `.subscribe()`
 * déjà passé côté premier mount, fait planter Realtime ("cannot add
 * postgres_changes callbacks ... after subscribe()"). Un seul canal réel par
 * userId est donc créé ici (un seul `.on()` avant l'unique `.subscribe()`),
 * partagé par référence-comptage entre tous les hooks montés ; chaque mount
 * ajoute juste son propre listener dans un Set, invoqué à chaque événement.
 * Même canal, même callback métier, aucun nouveau système realtime.
 */
const myDepartureChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<(payload: any) => void>; refCount: number }
>();

function acquireMyDepartureChannel(userId: string) {
  let entry = myDepartureChannels.get(userId);
  if (!entry) {
    const listeners = new Set<(payload: any) => void>();
    const channel = supabase
      .channel(`my-departures-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_departures", filter: `user_id=eq.${userId}` },
        (payload) => listeners.forEach((listener) => listener(payload))
      )
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    myDepartureChannels.set(userId, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseMyDepartureChannel(userId: string, listener: (payload: any) => void) {
  const entry = myDepartureChannels.get(userId);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    myDepartureChannels.delete(userId);
  }
}

/**
 * Notifie en temps réel le joueur d'un changement sur sa propre demande
 * (refus/expiration/force exit/acceptation) — écoute INSERT (release-member,
 * qui pose directement une ligne OWNER_RELEASED sans passer par PENDING) ET
 * UPDATE (respond-departure NOW/REFUSE, resolve-expired-departures FORCE_EXIT,
 * launch-match-checkin qui finalise une transition NEXT_MATCH en posant
 * release_match_checkin_id sur la ligne existante).
 *
 * N1 : dès qu'un événement signifie que le joueur vient de perdre effectivement
 * son club (peu importe qui a déclenché l'action côté serveur — owner/manager
 * sur un autre appareil, ou le sweep cron), invalide my-memberships pour que
 * l'onglet Club (clubs.tsx) bascule vers le matchmaking sans attendre le
 * refetch React Query naturel. Aucun nouveau système realtime : ce hook
 * existant est seulement étendu et doit être monté par tout écran qui doit
 * réagir immédiatement (clubs.tsx, MyDepartureStatusCard).
 */
export function useMyDepartureUpdates(userId: string | null, onChange: (status: DepartureStatus) => void) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const listener = (payload: any) => {
      const dep = payload.new as ClubDepartureRow;

      // INSERT PENDING = la propre demande du joueur (request-departure),
      // déjà notifiée par useRequestDeparture — évite un doublon de haptic/toast.
      if (payload.eventType === "INSERT" && dep.status === "PENDING") return;

      const membershipLost =
        dep.status === "ACCEPTED_NOW" ||
        dep.status === "FORCE_EXIT" ||
        dep.status === "OWNER_RELEASED" ||
        (dep.status === "ACCEPTED_NEXT_MATCH" && dep.release_match_checkin_id !== null);
      if (membershipLost) {
        queryClient.invalidateQueries({ queryKey: ["my-memberships", userId] });
        queryClient.invalidateQueries({ queryKey: ["club", dep.club_id] });
      }

      Haptics.notificationAsync(
        dep.status === "REFUSED" || dep.status === "EXPIRED"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      );
      onChange(dep.status);
    };

    const entry = acquireMyDepartureChannel(userId);
    entry.listeners.add(listener);

    return () => {
      releaseMyDepartureChannel(userId, listener);
    };
  }, [userId, onChange, queryClient]);
}

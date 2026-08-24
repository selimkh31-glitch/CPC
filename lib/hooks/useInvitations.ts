import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import { USER_PUBLIC_COLUMNS, type InvitationRow } from "@/lib/types";

/**
 * Club -> joueur (phase 4) : invitation sur un slot précis, via l'Edge
 * Function `invite-to-slot` (moteur inchangé, Foundation #2.2 n'y touche pas).
 * Invalide aussi `club-invitations` (clubId issu des variables de la mutation,
 * pas d'un hook séparé) pour que la section "Invitations en attente" du
 * Match Center se mette à jour immédiatement après un envoi — pas de nouveau
 * canal realtime, une simple invalidation de cache supplémentaire.
 */
export function useInvitePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { clubId: string; slotId: string; userId: string }) => callEdgeFunction("invite-to-slot", input),
    onSuccess: (_data, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["club-invitations", variables.clubId] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

/**
 * Foundation #2.2 / #2.4 — TOUTES les invitations envoyées par CE club
 * (lecture seule), tous statuts ET tous types confondus (PENDING/ACCEPTED/
 * DECLINED/CANCELLED ; slot_id null = invitation CLUB, slot_id non-null =
 * invitation MATCH). RLS `invitations_select_involved`
 * (0007_match_sheet_rls.sql) autorise déjà un OWNER/MANAGER de ce club à lire
 * ces lignes, quel que soit leur statut — aucun changement DB/RLS nécessaire,
 * symétrique de `useMyInvitations` (côté joueur receveur).
 *
 * Historiquement filtré `.eq("status", "PENDING")` côté requête (Match
 * Center uniquement) ; élargi à l'historique complet pour alimenter aussi
 * "Candidatures → Invitations envoyées" et "Effectif → Inviter au club"
 * (source de vérité persistante, survit au Match Day) sans dupliquer la
 * requête — même pattern que `useApplications` (lib/hooks/useApplications.ts) :
 * la requête charge tout, chaque consommateur filtre ensuite ce qu'il affiche
 * (voir `PendingInvitations` dans app/(club)/(tabs)/match.tsx, qui ne montre
 * que PENDING + slot_id non-null ; `ClubInvitationsPanel`, qui ne montre que
 * slot_id null ; `InviteToClubPanel`, qui dérive l'état du bouton par joueur
 * de ce même jeu de données — jamais de fetch au tap).
 *
 * Fix (audit "Impossible de charger les invitations") — `invitations` a DEUX
 * FK vers `users` (`user_id` et `invited_by`), donc `user:users(...)` sans
 * précision est une relation ambiguë pour PostgREST : la requête échouait
 * systématiquement avec `PGRST201` ("more than one relationship was found"),
 * confirmé en reproduisant l'appel REST brut. `!invitations_user_id_fkey`
 * force explicitement la relation via `user_id` (le joueur INVITÉ, jamais
 * l'inviteur) — comportement voulu depuis le début, jamais atteint en
 * pratique avant ce fix.
 *
 * Realtime : canal ref-compté `club-invitations-${clubId}` (postgres_changes
 * sur `invitations` filtré `club_id=eq.`), même doctrine que `useApplications`
 * / `useMyInvitations`. Match, Effectif et Candidatures montent ce hook en
 * parallèle — un second `.on()` après subscribe ferait planter Realtime.
 */
const clubInvitationsChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<(payload: any) => void>; refCount: number }
>();

function acquireClubInvitationsChannel(clubId: string) {
  let entry = clubInvitationsChannels.get(clubId);
  if (!entry) {
    const listeners = new Set<(payload: any) => void>();
    const channel = supabase
      .channel(`club-invitations-${clubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invitations", filter: `club_id=eq.${clubId}` },
        (payload) => listeners.forEach((listener) => listener(payload))
      )
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    clubInvitationsChannels.set(clubId, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseClubInvitationsChannel(clubId: string, listener: (payload: any) => void) {
  const entry = clubInvitationsChannels.get(clubId);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    clubInvitationsChannels.delete(clubId);
  }
}

export function useClubInvitations(clubId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["club-invitations", clubId],
    enabled: Boolean(clubId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select(`*, user:users!invitations_user_id_fkey(${USER_PUBLIC_COLUMNS})`)
        .eq("club_id", clubId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InvitationRow[];
    },
  });

  useEffect(() => {
    if (!clubId) return;
    const listener = () => queryClient.invalidateQueries({ queryKey: ["club-invitations", clubId] });
    const entry = acquireClubInvitationsChannel(clubId);
    entry.listeners.add(listener);
    return () => {
      releaseClubInvitationsChannel(clubId, listener);
    };
  }, [clubId, queryClient]);

  return query;
}

/**
 * Club -> joueur, invitation CLUB générale (pas de slot/match visé), via
 * l'Edge Function `invite-to-club` (déployée, distincte d'`invite-to-slot`,
 * jamais touchée). Met à jour directement le cache de `useClubInvitations`
 * avec la ligne réellement créée (retournée par la fonction) plutôt que
 * d'invalider/refetcher — le bouton "Inviter au club" (Effectif) et la
 * section "Invitations envoyées" (Candidatures) reflètent le nouveau statut
 * immédiatement, sans aller-retour réseau supplémentaire.
 *
 * Deux 409 métier possibles, ni l'un ni l'autre de vraies erreurs UX :
 * - "déjà une invitation en attente" — l'état PENDING existe déjà côté
 *   serveur, potentiellement pas encore reflété dans un cache local périmé :
 *   resynchronise `club-invitations` (source du statut PENDING/DECLINED/...).
 * - "déjà membre du club" — audit "cache club.members obsolète côté manager" :
 *   un joueur invité (via une invitation MATCH, `invite-to-slot`, jamais
 *   touchée ici) peut avoir rejoint le club sur SON appareil sans que rien ne
 *   prévienne le manager — `["club", clubId]` (lib/hooks/useClubs.ts, source
 *   de `club.members`) n'a alors pas de raison de se rafraîchir de son côté.
 *   Resynchronise cette query précise plutôt que "club-invitations" (aucun
 *   rapport avec les invitations ici, le vrai problème est la liste des
 *   membres) ; le fix durable (refetch au focus de l'onglet Effectif) vit
 *   dans app/(club)/(tabs)/effectif.tsx, pas ici.
 * Dans les deux cas, le composant appelant (InviteToClubPanel) décide lui-même
 * de ne pas toaster une erreur générique — il reflète l'état correct
 * immédiatement (localStatus) pendant que cette invalidation le confirme.
 */
export function useInvitePlayerToClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { clubId: string; userId: string }) =>
      callEdgeFunction<{ invitation: InvitationRow }>("invite-to-club", input),
    onSuccess: (data, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.setQueryData<InvitationRow[] | undefined>(["club-invitations", variables.clubId], (old) =>
        old ? [data.invitation, ...old] : [data.invitation]
      );
    },
    onError: (err: any, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = typeof err?.message === "string" ? err.message : "";
      if (message.includes("déjà une invitation en attente")) {
        queryClient.invalidateQueries({ queryKey: ["club-invitations", variables.clubId] });
      } else if (message.includes("déjà membre du club")) {
        queryClient.invalidateQueries({ queryKey: ["club", variables.clubId] });
      }
    },
  });
}

/**
 * Registre module-level des canaux `my-invitations-${userId}` — même
 * nécessité que `myDepartureChannels` (lib/hooks/useDepartures.ts) : ce hook
 * est désormais monté à la fois par app/(player)/(tabs)/profile.tsx (badge de
 * compteur, tab gardé monté en permanence) et par app/my-invitations.tsx
 * (écran externe). `supabase.channel(topic)` réutilise l'instance existante
 * pour un topic déjà connu du client Realtime : un second `.on(...)` sur un
 * canal déjà `subscribe()` par le premier mount ferait planter Realtime
 * ("cannot add postgres_changes callbacks ... after subscribe()"). Un seul
 * canal réel par userId est donc créé ici (un seul `.on()` avant l'unique
 * `.subscribe()`), partagé par référence-comptage entre tous les hooks
 * montés ; chaque mount ajoute juste son propre listener dans un Set.
 */
const myInvitationsChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<(payload: any) => void>; refCount: number }
>();

function acquireMyInvitationsChannel(userId: string) {
  let entry = myInvitationsChannels.get(userId);
  if (!entry) {
    const listeners = new Set<(payload: any) => void>();
    const channel = supabase
      .channel(`my-invitations-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invitations", filter: `user_id=eq.${userId}` },
        (payload) => listeners.forEach((listener) => listener(payload))
      )
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    myInvitationsChannels.set(userId, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseMyInvitationsChannel(userId: string, listener: (payload: any) => void) {
  const entry = myInvitationsChannels.get(userId);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    myInvitationsChannels.delete(userId);
  }
}

/** Invitations reçues par le joueur connecté (statut PENDING affiché en priorité). */
export function useMyInvitations(userId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-invitations", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*, club:clubs(id,name,level,formation)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InvitationRow[];
    },
  });

  useEffect(() => {
    if (!userId) return;

    const listener = () => queryClient.invalidateQueries({ queryKey: ["my-invitations", userId] });
    const entry = acquireMyInvitationsChannel(userId);
    entry.listeners.add(listener);

    return () => {
      releaseMyInvitationsChannel(userId, listener);
    };
  }, [userId, queryClient]);

  return query;
}

/** Le joueur invité accepte/refuse, via l'Edge Function `respond-invitation`. */
export function useRespondInvitation(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { invitationId: string; status: "ACCEPTED" | "DECLINED" }) =>
      callEdgeFunction("respond-invitation", vars),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-invitations", userId] });
      // L'acceptation crée un club_members MEMBER (accept_invitation, 0007_match_sheet_rls.sql).
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
    },
  });
}

/**
 * Phase 5, Étape 5 — réponse à une invitation de TRANSITION (`departure_request_id`
 * non nul sur l'invitation). Distinct de useRespondInvitation : l'acceptation
 * passe par `respond-transition-invitation` (PENDING -> RESERVED, jamais
 * ACCEPTED direct — le joueur n'intègre club_members du nouveau club qu'à la
 * finalisation par launch-match-checkin, au match libérateur chez son club
 * actuel). Le refus suit le même chemin que pour une invitation normale.
 */
export function useRespondTransitionInvitation(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { invitationId: string; status: "ACCEPTED" | "DECLINED" }) =>
      callEdgeFunction("respond-transition-invitation", vars),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-invitations", userId] });
    },
  });
}

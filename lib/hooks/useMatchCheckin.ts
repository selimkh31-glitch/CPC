import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { callEdgeFunction } from "@/lib/api/edge";
import { supabase } from "@/lib/supabase/client";
import type { MatchCheckinRow, MatchParticipantRow, MatchResultRow } from "@/lib/types";

export interface MatchCheckinResult {
  checkin: {
    id: string;
    club_id: string;
    session_id: string;
    formation_id: string | null;
    launched_at: string;
    launched_by: string | null;
    created_at: string;
  };
  presentUserIds: string[];
  absentUserIds: string[];
  finalizedDepartures: Array<{
    userId: string;
    departureId: string;
    transitioned: boolean;
    targetClubId: string | null;
  }>;
}

/**
 * Lancement du check-in (Phase 5, Étape 3) — seule porte d'écriture vers
 * match_checkins/match_participations/matches_played_count : l'Edge Function
 * launch-match-checkin (service_role). Le client ne touche jamais ces tables
 * ni ces colonnes directement (voir le revoke posé en 0010/0011 sur
 * club_members) — cette mutation est le SEUL chemin d'écriture disponible
 * côté app pour le check-in.
 */
export function useLaunchMatchCheckin(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; absentUserIds: string[] }) =>
      callEdgeFunction<MatchCheckinResult>("launch-match-checkin", {
        clubId,
        sessionId: input.sessionId,
        absentUserIds: input.absentUserIds,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Rafraîchit slotAssignments/members depuis le serveur — le client
      // n'incrémente/ne modifie jamais rien lui-même, il relit juste l'état
      // déjà déterminé côté backend (slots absents libérés, etc.).
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      // Phase F.1 — le check-in qu'on vient de lancer devient le nouveau
      // check-in actif : force la source de vérité serveur à se resynchroniser
      // plutôt que de laisser une copie locale périmée dans le cache.
      queryClient.invalidateQueries({ queryKey: ["active-match-checkin", clubId] });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
}

/**
 * Match Result Engine, Phase F.1 — dernier match_checkin de ce club qui n'a
 * PAS encore de match_results associé (retourne `null` sinon : aucun
 * check-in, ou le dernier est déjà finalisé). Source de vérité SERVEUR pour
 * "match actif" — remplace l'état React local perdu à la navigation/au
 * reload (`lastResult` dans MatchCheckinPanel). match_checkins et
 * match_results sont tous les deux en lecture publique-authentifiée (RLS,
 * voir 0010_engagement_model.sql / 0014_match_results.sql) : deux requêtes
 * directes suffisent, aucun besoin d'Edge Function pour de la lecture.
 *
 * Deux requêtes séparées plutôt qu'un embed PostgREST `match_checkins ->
 * match_results` : la FK est composite (matchCheckinId, clubId) portée par
 * une contrainte unique elle aussi composite (@@unique) en plus de l'unique
 * simple sur matchCheckinId — un embed reste risqué à faire deviner à
 * PostgREST sans schéma live sous la main pour le vérifier. Deux requêtes
 * ciblées par id sont triviales et sans ambiguïté.
 */
export function useActiveMatchCheckin(clubId: string | null) {
  return useQuery({
    queryKey: ["active-match-checkin", clubId],
    enabled: Boolean(clubId),
    queryFn: async () => {
      const { data: checkin, error } = await supabase
        .from("match_checkins")
        .select("*")
        .eq("club_id", clubId!)
        .order("launched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!checkin) return null;

      const { data: result, error: resultError } = await supabase
        .from("match_results")
        .select("id")
        .eq("match_checkin_id", checkin.id)
        .maybeSingle();
      if (resultError) throw resultError;

      return result ? null : (checkin as MatchCheckinRow);
    },
  });
}

/**
 * Match Result Engine, Phase F.2 — joueurs éligibles au MVP pour un check-in
 * donné : uniquement les PRESENT réels de CE match (match_participations),
 * jamais le roster actuel du club (qui peut avoir changé depuis le
 * lancement). match_participations est en lecture publique-authentifiée
 * (RLS, voir 0010_engagement_model.sql) — même raisonnement que
 * useActiveMatchCheckin, aucune Edge Function nécessaire pour une lecture.
 */
export function useMatchParticipants(matchCheckinId: string | null) {
  return useQuery({
    queryKey: ["match-participants", matchCheckinId],
    enabled: Boolean(matchCheckinId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_participations")
        .select("user_id, user:users(username)")
        .eq("match_checkin_id", matchCheckinId!)
        .eq("status", "PRESENT");
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        user_id: row.user_id as string,
        username: (row.user?.username as string | undefined) ?? "Joueur",
      })) as MatchParticipantRow[];
    },
  });
}

export interface FinalizeMatchResult {
  matchResult: MatchResultRow;
}

/**
 * Finalisation du résultat (Match Result Engine, Phase F.2) — seule porte
 * d'écriture vers match_results : l'Edge Function finalize-match
 * (service_role, appelle finalize_match SECURITY DEFINER). `outcome` n'est
 * JAMAIS envoyé ni recalculé côté client — reçu tel quel dans la réponse.
 * `actor_id` n'est JAMAIS envoyé : dérivé du JWT côté Edge Function
 * (getCallingUser). opponentClubId / competitionId sont optionnels côté
 * Edge ; l'UI owner/manager exige un club adverse CPC réel. Les erreurs
 * nommées du backend arrivent déjà traduites en FR par mapFinalizeError.
 */
export function useFinalizeMatch(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      matchCheckinId: string;
      ourScore: number;
      opponentScore: number;
      mvpUserId: string | null;
      opponentClubId: string | null;
      competitionId: string | null;
    }) =>
      callEdgeFunction<FinalizeMatchResult>("finalize-match", {
        matchCheckinId: input.matchCheckinId,
        ourScore: input.ourScore,
        opponentScore: input.opponentScore,
        mvpUserId: input.mvpUserId,
        opponentClubId: input.opponentClubId,
        competitionId: input.competitionId,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Ce check-in a maintenant un match_results : il n'est plus "actif" au
      // sens de useActiveMatchCheckin — resynchronise depuis le serveur
      // plutôt que de le déduire localement (même doctrine que le reste du
      // fichier : le client ne fait jamais confiance à un état local pour ce
      // qui doit venir de la DB).
      queryClient.invalidateQueries({ queryKey: ["active-match-checkin", clubId] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition"] });
      queryClient.invalidateQueries({ queryKey: ["competition-linked-results"] });
      queryClient.invalidateQueries({ queryKey: ["club-open-competitions"] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournament"] });
      queryClient.invalidateQueries({ queryKey: ["tournament-matches"] });
      queryClient.invalidateQueries({ queryKey: ["tournament-round-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["player-match-history"] });
      queryClient.invalidateQueries({ queryKey: ["club-match-history"] });
      queryClient.invalidateQueries({ queryKey: ["cpc-club-ranking-results"] });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
}

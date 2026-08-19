/**
 * M2 — filtrage amont des joueurs déjà engagés ailleurs (lib/hooks/usePlayerSearch.ts).
 *
 * Exclut les candidats ayant déjà un membership actif MEMBER/MANAGER dans un
 * autre club SANS départ en cours (`active_departure_request_id` null) :
 * `invite-to-slot` (Edge Function, inchangée) les rejette de toute façon avec
 * `already_has_active_club`, sans exception. Éviter de les proposer est donc
 * une pure optimisation UX — le serveur reste seul juge.
 *
 * Les candidats ayant un `active_departure_request_id` non nul (départ
 * PENDING en attente de réponse OU transition ACCEPTED_NEXT_MATCH) restent
 * affichés : le statut exact de ce départ appartient à un autre club et n'est
 * pas lisible par l'utilisateur courant (RLS `club_departures_select_involved`,
 * volontairement non modifiée pour cette étape — voir rapport M2). Filtrer
 * uniquement sur la présence de `active_departure_request_id`, sans son
 * statut, permet de ne jamais masquer un candidat en transition légitime
 * (le parcours de recrutement d'un joueur ACCEPTED_NEXT_MATCH doit rester
 * fonctionnel) au prix de laisser visible, dans le cas plus rare d'un départ
 * PENDING (fenêtre de 3 minutes), un candidat qu'`invite-to-slot` rejettera —
 * comportement strictement identique à avant cette étape pour ce cas précis,
 * donc aucune régression.
 *
 * Logique pure, sans I/O, volontairement extraite dans son propre module
 * (pas d'import supabase/react-native) pour rester testable en isolation.
 */
export function excludeFullyEngagedElsewhere<T extends { id: string }>(
  candidates: T[],
  activeMemberships: { user_id: string; active_departure_request_id: string | null }[]
): T[] {
  const fullyEngagedUserIds = new Set(
    activeMemberships.filter((m) => m.active_departure_request_id === null).map((m) => m.user_id)
  );
  return candidates.filter((c) => !fullyEngagedUserIds.has(c.id));
}

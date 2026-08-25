/**
 * Transitions de recrutement — réexport de la source unique Edge/app.
 * Voir supabase/functions/_shared/recruitment.ts.
 *
 * `playerInvitationAcceptHref` est app-only : après ACCEPTED le joueur
 * atterrit sur la feuille du club (`/match-sheet`), jamais Recrutement.
 */
export * from "../supabase/functions/_shared/recruitment";

/** Feuille joueur (ClubHome) — pas `/match` (arbre manager) ni `/candidatures`. */
export function playerInvitationAcceptHref(clubId: string | null | undefined): string | null {
  if (typeof clubId !== "string") return null;
  const id = clubId.trim();
  if (!id) return null;
  return `/match-sheet?clubId=${encodeURIComponent(id)}`;
}

/**
 * Safety (block/report) + href notifications — réexport de la source unique.
 * Voir supabase/functions/_shared/safety.ts.
 */
import {
  competitionClubRegisteredHref,
  matchFinalizedHref,
  notificationHref,
  tournamentRoundScheduledHref,
} from "../supabase/functions/_shared/safety";
import { recruitmentNotificationNav } from "../supabase/functions/_shared/recruitment";

export * from "../supabase/functions/_shared/safety";

/**
 * Cible in-app d'une notification, selon le mode monté.
 * APPLICATION_RECEIVED, INVITATION_ACCEPTED, INVITATION_DECLINED → Recrutement
 * (`/candidatures`) : ApplicationsPanel + ClubInvitationsPanel. `/club/[id]`
 * n'a pas le statut d'invitation. L'appelant doit passer en Mode Club et
 * sélectionner `data.clubId` (voir recruitmentNotificationNav).
 * MATCH_FINALIZED → `/tournaments/[id]` si kind TOURNAMENT, sinon
 * `/competitions/[id]` si `competitionId`, sinon `/club/[id]` (historique
 * du club enregistreur). Sans clubId ni competitionId → `/notifications`.
 * Jamais `/match` (feuille, pas le résultat).
 * COMPETITION_CLUB_REGISTERED → même stack selon kind.
 * TOURNAMENT_ROUND_SCHEDULED → `/tournaments/[id]`. Pas d'écran mort.
 */
export function inAppNotificationHref(
  type: string,
  data: Record<string, unknown> | null | undefined,
  mode: "PLAYER" | "CLUB"
): string {
  const recruitment = recruitmentNotificationNav(type, data);
  if (recruitment) return recruitment.href;
  if (type === "MATCH_FINALIZED") return matchFinalizedHref(data, mode);
  if (type === "COMPETITION_CLUB_REGISTERED") return competitionClubRegisteredHref(data);
  if (type === "TOURNAMENT_ROUND_SCHEDULED") return tournamentRoundScheduledHref(data);
  return notificationHref(type, data);
}

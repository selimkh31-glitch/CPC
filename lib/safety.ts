/**
 * Safety (block/report) + href notifications — réexport de la source unique.
 * Voir supabase/functions/_shared/safety.ts.
 */
import { matchFinalizedHref, notificationHref } from "../supabase/functions/_shared/safety";
import { recruitmentNotificationNav } from "../supabase/functions/_shared/recruitment";

export * from "../supabase/functions/_shared/safety";

/**
 * Cible in-app d'une notification, selon le mode monté.
 * APPLICATION_RECEIVED → Recrutement (`/candidatures`), où ApplicationsPanel
 * accepte/refuse. `/club/[id]` n'a pas ces actions. L'appelant doit passer
 * en Mode Club et sélectionner `data.clubId` (voir recruitmentNotificationNav).
 * MATCH_FINALIZED → `/competitions` si `competitionId`, sinon `/match`
 * (feuille Mode Club). Pas d'écran mort.
 */
export function inAppNotificationHref(
  type: string,
  data: Record<string, unknown> | null | undefined,
  mode: "PLAYER" | "CLUB"
): string {
  const recruitment = recruitmentNotificationNav(type, data);
  if (recruitment) return recruitment.href;
  if (type === "MATCH_FINALIZED") return matchFinalizedHref(data, mode);
  return notificationHref(type, data);
}

/**
 * Safety (block/report) + href notifications — réexport de la source unique.
 * Voir supabase/functions/_shared/safety.ts.
 */
import { notificationHref } from "../supabase/functions/_shared/safety";

export * from "../supabase/functions/_shared/safety";

/**
 * Cible in-app d'une notification, selon le mode monté.
 * APPLICATION_RECEIVED en Mode Club → Recrutement (`/candidatures`), où
 * ApplicationsPanel accepte/refuse. `/club/[id]` n'a pas ces actions.
 * En Mode Joueur on garde `/club/[id]` (arbre Club non monté).
 */
export function inAppNotificationHref(
  type: string,
  data: Record<string, unknown> | null | undefined,
  mode: "PLAYER" | "CLUB"
): string {
  if (type === "APPLICATION_RECEIVED" && mode === "CLUB") return "/candidatures";
  return notificationHref(type, data);
}

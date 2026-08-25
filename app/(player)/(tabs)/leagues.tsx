import { Redirect } from "expo-router";
import { LEAGUES_STACK_HREF } from "@/lib/leagues";

/**
 * Alias deep link — Ligues hors tab bar (`href: LEAGUES_TAB_HREF` = null).
 * Contenu réel : stack partagé `app/leagues.tsx` (header back, Mode Club inclus).
 */
export default function LeaguesTabRedirect() {
  return <Redirect href={LEAGUES_STACK_HREF} />;
}

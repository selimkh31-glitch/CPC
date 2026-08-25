/**
 * Ligues (`/leagues`) — stack partagé `app/leagues.tsx`, hors tab bar (`href: null`).
 *
 * Deux surfaces distinctes :
 * 1) Classement clubs CPC (`lib/rankings.ts`) — surface principale, depuis
 *    `match_results` avec `opponent_club_id` seulement. Pas `season_stats`.
 *    Pas une ligue EA.
 * 2) Classement saison (`season_stats`) — HONNÊTEMENT VIDE, secondaire.
 *    Writers réels (aucun n'agrège `match_results`) : `prisma/seed.ts`,
 *    `ea-sync`, `season-ranking`. `mvp_count` n'est jamais incrémenté hors seed.
 *    `canShowLiveLeagueRanking()` reste false.
 *
 * Le classement compétition vit sur `/competitions`, uniquement depuis des
 * résultats liés.
 *
 * Navigation : `LeaguesLink` pousse `/leagues` (cet écran). Ne pas recréer
 * un fichier tab `app/(player)/(tabs)/leagues.tsx` — deux fichiers pour le
 * même path cassent Club → Classement / le bouton retour.
 */
import { canFillStandingsFromMatchResults } from "./competitions";

export const LEAGUE_COPY = {
  title: "Ligues",
  empty: "Nous n'avons pas de classement de ligue saison réel tant que les stats saison ne viennent pas des résultats Pro Clubs.",
  emptyHint: "Pas de points, divisions, buteurs ou MVP inventés. Les stats saison (seed / sync EA) ne remplissent pas ce tableau.",
} as const;

/** Tab bar joueur : Ligues reste hors onglets (`href: null`, Redirect vers le stack). */
export const LEAGUES_TAB_HREF: null = null;

/** Stack partagé `/leagues` (`app/leagues.tsx`) — Profil / Effectif via `LeaguesLink`. Pas un 4e onglet. */
export const LEAGUES_STACK_HREF = "/leagues" as const;

/** Cible unique de `LeaguesLink` (`router.push`). Tab `href` reste `null`. */
export function pushLeaguesScreen(push: (href: typeof LEAGUES_STACK_HREF) => unknown): void {
  push(LEAGUES_STACK_HREF);
}

/** `season_stats` n'est pas alimenté par `finalize_match` / `match_results`. */
export const SEASON_STATS_WRITTEN_FROM_MATCH_RESULTS = false;

/**
 * Afficher « Classement général » saison seulement si on peut le remplir depuis
 * les matchs enregistrés ET que `season_stats` (ou équivalent) en est dérivé.
 * Défaut actuel : false. Ne jamais court-circuiter avec du seed / EA / fake.
 * Le tableau clubs CPC (`canShowCpcClubRanking`) est un autre gate.
 */
export function canShowLiveLeagueRanking(
  input: {
    matchResultsColumns?: readonly string[];
    seasonStatsWrittenFromMatchResults?: boolean;
  } = {}
): boolean {
  const fromMatchResults =
    input.seasonStatsWrittenFromMatchResults ?? SEASON_STATS_WRITTEN_FROM_MATCH_RESULTS;
  return fromMatchResults && canFillStandingsFromMatchResults(input.matchResultsColumns);
}

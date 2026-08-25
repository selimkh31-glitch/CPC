/**
 * Ligues (`/leagues`) — écran hors tab bar (`href: null`).
 *
 * Classement live uniquement si les lignes sont calculées depuis les
 * résultats Pro Clubs que CPC enregistre (`match_results` via
 * `finalize_match`). Ce n'est pas le cas aujourd'hui.
 *
 * Writers réels de `season_stats` (aucun n'agrège `match_results`) :
 * - `prisma/seed.ts` — faker (hors prod)
 * - `ea-sync` — formule goals×4 + assists×3 + cleanSheets×2 (payload club EA,
 *   rapprochement username, pas un id joueur vérifié)
 * - `season-ranking` — percentiles de `division` sur ces points
 * `mvp_count` n'est jamais incrémenté hors seed. `/leagues` n'affiche pas
 * de classement live (`season_stats` ≠ `match_results`). Le classement
 * compétition vit sur `/competitions`, uniquement depuis des résultats liés.
 */
import { canFillStandingsFromMatchResults } from "./competitions";

export const LEAGUE_COPY = {
  title: "Ligues",
  empty: "Nous n'avons pas de classement réel tant que les résultats Pro Clubs ne sont pas liés.",
  emptyHint: "Pas de points, divisions, buteurs ou MVP inventés. Les matchs que CPC enregistre ne remplissent pas encore un classement.",
} as const;

/** Tab bar joueur : Ligues reste hors onglets (deep link `/leagues` seulement). */
export const LEAGUES_TAB_HREF: null = null;

/** `season_stats` n'est pas alimenté par `finalize_match` / `match_results`. */
export const SEASON_STATS_WRITTEN_FROM_MATCH_RESULTS = false;

/**
 * Afficher « Classement général » seulement si on peut le remplir depuis
 * les matchs enregistrés ET que `season_stats` (ou équivalent) en est dérivé.
 * Défaut actuel : false. Ne jamais court-circuiter avec du seed / EA / fake.
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

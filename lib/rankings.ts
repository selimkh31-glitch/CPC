/**
 * Classement clubs CPC — `/leagues` (surface principale du stack partagé), pas un onglet.
 *
 * Source unique : `match_results` avec `opponent_club_id` (finalize_match).
 * Scorer = famille compétitions (`computeStandingsFromLinkedResults`, W=3 D=1 L=0).
 * Jamais `season_stats`, seed, ni ea-sync. Pas de filtre saison : `match_results`
 * n'a pas de `season_id` (ne pas ALTER pour l'inventer) → classement global,
 * libellé « Classement clubs CPC », pas « Ligue EA ».
 *
 * Classement joueur : join réel PRESENT → results existe (historique), mais
 * trop mince (pas de buts/passes par joueur sur `match_results` ; seulement
 * le club enregistreur). Skip plutôt qu'inventer.
 */
import {
  MATCH_RESULT_COLUMNS,
  computeStandingsFromLinkedResults,
  isMatchResultOutcome,
  type CompetitionStandingRow,
  type LinkedMatchResultInput,
} from "./competitions";

export type CpcClubStandingRow = CompetitionStandingRow;

export const RANKING_COPY = {
  clubTitle: "Classement clubs CPC",
  clubSubtitle:
    "Tous les matchs CPC enregistrés avec un adversaire. Classement global — pas une ligue EA.",
  clubEmpty: "Pas encore de match CPC enregistré avec un adversaire.",
  clubEmptyHint:
    "Seuls les résultats Pro Clubs avec un club adverse CPC comptent. Pas de tableau 0-0-0 inventé.",
  clubLoadError: "Impossible de charger le classement clubs CPC.",
} as const;

/** `match_results` n'a pas de FK saison aujourd'hui (0014 + 0027). */
export function matchResultsHasSeasonId(
  columns: readonly string[] = MATCH_RESULT_COLUMNS
): boolean {
  return columns.includes("season_id");
}

/**
 * Filtrer le tableau par saison seulement si une vraie colonne saison existe
 * sur `match_results`. Sans ça : classement global, pas une ligue saison.
 */
export function canFilterCpcRankingBySeason(
  columns: readonly string[] = MATCH_RESULT_COLUMNS
): boolean {
  return matchResultsHasSeasonId(columns);
}

/**
 * Join PRESENT → match_results est réel (historique joueur) mais trop mince
 * pour un classement : pas de stats individuelles persistées, participations
 * du club enregistreur seulement.
 */
export const CPC_PLAYER_RANKING_AVAILABLE = false;

export function canShowCpcPlayerRanking(): boolean {
  return CPC_PLAYER_RANKING_AVAILABLE;
}

/** Colonnes 0027 : `opponent_club_id` suffit (competition_id optionnel ici). */
export function canFillCpcClubRankingFromMatchResults(
  columns: readonly string[] = MATCH_RESULT_COLUMNS
): boolean {
  return columns.includes("opponent_club_id");
}

export function isCpcClubRankingResult(row: LinkedMatchResultInput): boolean {
  return (
    typeof row.opponent_club_id === "string" &&
    row.opponent_club_id.length > 0 &&
    row.opponent_club_id !== row.club_id &&
    isMatchResultOutcome(row.outcome)
  );
}

export function hasCpcClubRankingResults(rows: readonly LinkedMatchResultInput[]): boolean {
  return rows.some(isCpcClubRankingResult);
}

export function canShowCpcClubRanking(
  rows: readonly LinkedMatchResultInput[],
  columns: readonly string[] = MATCH_RESULT_COLUMNS
): boolean {
  return canFillCpcClubRankingFromMatchResults(columns) && hasCpcClubRankingResults(rows);
}

/**
 * Classement clubs CPC : même scorer que les compétitions, sans exiger
 * `competition_id`. Une ligne sans adverse est ignorée.
 */
export function computeCpcClubStandings(
  rows: readonly LinkedMatchResultInput[]
): CpcClubStandingRow[] {
  return computeStandingsFromLinkedResults(rows, isCpcClubRankingResult);
}

/** Le classement saison (`season_stats`) reste un autre canal — pas celui-ci. */
export function cpcClubRankingUsesSeasonStats(): boolean {
  return false;
}

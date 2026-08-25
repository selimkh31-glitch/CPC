import type {
  EAClub,
  EAClubStats,
  EALeaderboardEntry,
  EAMatch,
  EAPlayer,
  EAPlayerCareerStats,
  EAPlayerStats,
  EAPlayoffData,
  EAProviderName,
} from "./types.ts";

/**
 * EAProvider — toute Edge Function qui a besoin de données EA dépend de
 * CETTE interface, jamais d'un fetch direct vers proclubs.ea.com.
 *
 * Implémentation actuelle : unofficial /api/fc (proClubsAdapter.ts).
 *
 * `null` = introuvable ou source indisponible (fallback silencieux).
 * Une méthode sans endpoint /api/fc branché lève `NotImplementedError`
 * (pas un `null` qui ressemblerait à "aucune donnée").
 */
export class NotImplementedError extends Error {
  constructor(method: string) {
    super(
      `EAProvider.${method} — READY FOR PROVIDER (aucun endpoint /api/fc branché pour cette donnée ; ne pas inventer de réponse).`
    );
    this.name = "NotImplementedError";
  }
}

export interface EAProvider {
  readonly name: EAProviderName;

  /**
   * Recherche de clubs EA par nom — LISTE complète, jamais le premier hit.
   * `null` = source indisponible / flag off ; `[]` = aucun candidat honnête.
   */
  searchClub(clubName: string, platform?: string): Promise<EAClub[] | null>;

  /** GET /clubs/info */
  getClub(clubId: string, platform?: string): Promise<EAClub | null>;

  /** GET /clubs/overallStats */
  getClubStats(clubId: string, platform?: string): Promise<EAClubStats | null>;

  /** Matchs récents : leagueMatch + friendlyMatch + playoffMatch (max 10 chacun). */
  getClubMatches(clubId: string, platform?: string): Promise<EAMatch[] | null>;

  /** GET /members/stats — effectif du club (identité = name / playername). */
  getClubMembers(clubId: string, platform?: string): Promise<EAPlayer[] | null>;

  /** Stats d'un joueur, agrégées depuis les matchs du club (égalité
   *  username == playername, jamais une clé persona). */
  getPlayerStats(clubId: string, playerName: string, platform?: string): Promise<EAPlayerStats | null>;

  /** GET /members/career/stats — toutes les carrières du club. */
  getClubCareerStats(clubId: string, platform?: string): Promise<EAPlayerCareerStats[] | null>;

  /** Une carrière, filtrée par playername dans le payload club. */
  getPlayerCareerStats(clubId: string, playerName: string, platform?: string): Promise<EAPlayerCareerStats | null>;

  /** READY FOR PROVIDER — /currentSeasonLeaderboard hors /search. */
  getLeaderboard(platform?: string): Promise<EALeaderboardEntry[] | null>;

  /** READY FOR PROVIDER — pas d'autre famille que /clubs/matches?matchType=playoffMatch. */
  getPlayoffData(clubId: string, platform?: string): Promise<EAPlayoffData | null>;
}

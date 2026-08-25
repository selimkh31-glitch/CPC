/**
 * Types normalisés CPC à partir du JSON brut unofficial proclubs.ea.com/api/fc.
 * Chaîne : CLIENT -> Edge Function -> EAProvider -> hop Node (si Deno) ->
 * /api/fc -> normalize.ts -> tables d'import CPC / verified_stats.
 *
 * Toute donnée EA porte sa provenance (`provider`, `externalId`,
 * `externalPlatform`, `syncedAt`) — jamais mélangée silencieusement à une
 * métrique CPC. Import stocké comme non vérifié.
 */

/** "proclubs-community" = /api/fc non officiel. "ea-official" réservé, pas d'implémentation. */
export type EAProviderName = "proclubs-community" | "ea-official";

export interface EAProvenance {
  provider: EAProviderName;
  /** Identifiant EA (clubId, ou playername pour une ligne joueur) — jamais un id CPC. */
  externalId: string;
  externalPlatform: string | null;
  /** Instant de la normalisation (pas de l'appel réseau brut). */
  syncedAt: string;
}

export interface EAClub extends EAProvenance {
  name: string;
  crestId: string | null;
}

export interface EAPlayer extends EAProvenance {
  name: string;
  proPosition: string | null;
  gamesPlayed: number | null;
  goals: number | null;
  assists: number | null;
  ratingAve: number | null;
  proName: string | null;
}

export interface EAClubStats extends EAProvenance {
  wins: number | null;
  losses: number | null;
  draws: number | null;
  titlesWon: number | null;
  gamesPlayed: number | null;
}

export interface EAPlayerMatchStats {
  /** Nom EA du joueur (`playername`/`name`) — seule clé de rapprochement
   *  (égalité username CPC). Chaîne vide si absente, jamais `null`. */
  name: string;
  goals: number;
  assists: number;
  cleanSheetsAny: number;
  rating: number | null;
}

export type EAMatchType = "leagueMatch" | "friendlyMatch" | "playoffMatch" | "unknown";

export interface EAMatch extends EAProvenance {
  matchId: string | null;
  matchType: EAMatchType;
  timestamp: string | null;
  /**
   * Clé = identifiant joueur brut du payload (persona) — NE JAMAIS indexer
   * par nom ici et NE JAMAIS persister cette clé comme login CPC.
   * Rapprochement par `EAPlayerMatchStats.name`.
   */
  players: Record<string, EAPlayerMatchStats>;
}

export interface EAPlayerStats extends EAProvenance {
  goals: number;
  assists: number;
  cleanSheets: number;
  matchesPlayed: number;
  avgRating: number | null;
}

export interface EAPlayerCareerStats extends EAProvenance {
  proName: string | null;
  proOverall: number | null;
  gamesPlayed: number | null;
  goals: number | null;
  assists: number | null;
  ratingAve: number | null;
  proPosition: string | null;
}

export interface EALeaderboardEntry extends EAProvenance {
  rank: number | null;
  clubName: string | null;
  points: number | null;
}

export interface EAPlayoffData extends EAProvenance {
  divisionReached: number | null;
  bestResult: string | null;
}

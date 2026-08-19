/**
 * EA Data Foundation — types normalisés (mission "EA DATA FOUNDATION",
 * sections 6-7). CE NE SONT PAS les JSON bruts renvoyés par les endpoints
 * communautaires proclubs.ea.com/api/fc/... — ce sont les formes stables que
 * consomme CPC, produites par normalize.ts à partir de ce JSON brut
 * (potentiellement incomplet, changeant, sans contrat officiel EA).
 *
 * Chaîne visée (section 6) :
 *   CLIENT -> Edge Function -> EAProvider (provider.ts) -> EA SOURCE
 *   -> normalize.ts -> CPC DATA MODEL (ces types) -> React Query / UI
 *
 * Toute donnée issue d'EA porte sa provenance explicitement (`provider`,
 * `externalId`, `externalPlatform`, `syncedAt`) — jamais mélangée
 * silencieusement à une métrique CPC (reliability_score, MVP, streak...).
 * Voir section 20 du brief : "Ne pas écraser une donnée CPC avec une donnée
 * EA. Ne pas prétendre qu'une statistique CPC provient d'EA."
 */

/** "proclubs-community" = endpoints semi-publics actuels (NON officiels).
 *  "ea-official" n'existe pas encore comme implémentation : réservé pour le
 *  jour où la FC Community API officielle EA sera accessible à ce projet. */
export type EAProviderName = "proclubs-community" | "ea-official";

export interface EAProvenance {
  provider: EAProviderName;
  /** Identifiant EA (ex: clubId) — jamais un id CPC. */
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
}

export interface EAClubStats extends EAProvenance {
  wins: number | null;
  losses: number | null;
  draws: number | null;
  titlesWon: number | null;
}

export interface EAPlayerMatchStats {
  /** Nom EA du joueur tel que renvoyé par le match (`playername`/`name`) —
   *  seule clé de rapprochement disponible (l'API n'expose pas d'id joueur
   *  stable mappable à nos users.id, voir EAMatch.players ci-dessous). Chaîne
   *  vide si absente du payload, jamais `null` (simplifie les comparaisons
   *  insensibles à la casse côté agrégation, voir normalize.ts>aggregatePlayerStats). */
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
   * Clé = identifiant de joueur EA brut tel que renvoyé par le payload
   * (persona id, PAS un nom) — NE JAMAIS indexer directement par nom de
   * joueur ici, c'est un bug déjà commis une fois (voir aggregatePlayerStats
   * ci-dessous, normalize.ts). L'API ne fournit aucun id joueur stable
   * rapprochable de nos users.id : le rapprochement se fait par valeur, via
   * `EAPlayerMatchStats.name` (comparaison insensible à la casse), jamais
   * via cette clé d'objet.
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

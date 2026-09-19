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
 * EAProvider — abstraction obligatoire (mission section 6). Toute nouvelle
 * Edge Function qui a besoin de données EA doit dépendre de CETTE interface,
 * jamais d'un fetch direct vers proclubs.ea.com. Objectif : pouvoir brancher
 * un jour la FC Community API officielle EA (accès conditionné, pas encore
 * disponible pour ce projet) SANS réécrire les appelants — seule
 * l'implémentation (proClubsAdapter.ts aujourd'hui, un futur
 * officialEaAdapter.ts demain) changerait.
 *
 * IMPORTANT : ceci n'est PAS une intégration à une API EA officielle. La
 * seule implémentation existante (proClubsAdapter.ts) enveloppe des
 * endpoints communautaires non garantis — voir _shared/ea.ts, logique
 * historique conservée telle quelle et réutilisée ici, jamais dupliquée.
 *
 * Chaque méthode retourne `null` quand la donnée est introuvable ou que la
 * source est temporairement indisponible (jamais d'exception qui remonterait
 * jusqu'au client — section 8 : fallback silencieux, EA non bloquant pour
 * CPC). Une méthode qui n'a AUCUNE implémentation réelle aujourd'hui lève
 * `NotImplementedError` à la place : un appelant qui l'utiliserait doit le
 * savoir immédiatement, pas recevoir un `null` trompeur qui ressemblerait à
 * "aucune donnée trouvée" (règle 44 : ne jamais faire du fake).
 */
export class NotImplementedError extends Error {
  constructor(method: string) {
    super(
      `EAProvider.${method} — READY FOR PROVIDER (aucun endpoint communautaire fiable identifié/validé pour cette donnée à ce jour ; ne pas inventer de réponse).`
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

  /** READY FOR PROVIDER — aucun endpoint "club par id" validé aujourd'hui. */
  getClub(clubId: string, platform?: string): Promise<EAClub | null>;

  /** READY FOR PROVIDER — /clubs/overallStats jamais appelé/validé ici. */
  getClubStats(clubId: string, platform?: string): Promise<EAClubStats | null>;

  /** Matchs récents (ligue + amicaux) — déjà utilisé en prod via ea-sync. */
  getClubMatches(clubId: string, platform?: string): Promise<EAMatch[] | null>;

  /** Effectif /members/stats — best-effort preview claim. `null` si hop down. */
  getClubMembers(clubId: string, platform?: string): Promise<EAPlayer[] | null>;

  /** Stats d'un joueur, agrégées depuis les matchs du club (égalité
   *  username == playername, jamais une clé persona). */
  getPlayerStats(clubId: string, playerName: string, platform?: string): Promise<EAPlayerStats | null>;

  /** READY FOR PROVIDER — /members/career/stats jamais appelé/validé ici. */
  getPlayerCareerStats(playerName: string, platform?: string): Promise<EAPlayerCareerStats | null>;

  /** READY FOR PROVIDER — currentSeasonLeaderboard jamais appelé ici (seule
   *  sa variante /search est utilisée, via searchClub). */
  getLeaderboard(platform?: string): Promise<EALeaderboardEntry[] | null>;

  /** READY FOR PROVIDER — /club/playoffAchievements jamais appelé/validé ici. */
  getPlayoffData(clubId: string, platform?: string): Promise<EAPlayoffData | null>;
}

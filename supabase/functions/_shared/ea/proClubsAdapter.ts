import { FEATURE_EA_STATS, eaGet } from "../ea.ts";
import { NotImplementedError, type EAProvider } from "./provider.ts";
import type {
  EAClub,
  EAClubStats,
  EALeaderboardEntry,
  EAMatch,
  EAPlayer,
  EAPlayerCareerStats,
  EAPlayerStats,
  EAPlayoffData,
} from "./types.ts";
import { aggregatePlayerStats, normalizeClub, normalizeMatch } from "./normalize.ts";

const DEFAULT_PLATFORM = "common-gen5";

/**
 * Implémentation concrète d'EAProvider pour les endpoints communautaires
 * proclubs.ea.com (mission section 5-6). NON officielle EA — voir en-tête de
 * provider.ts et de _shared/ea.ts.
 *
 * Réutilise le client défensif existant (`eaGet`, retries/timeout/headers de
 * _shared/ea.ts) plutôt que de le redupliquer. `ea-sync` et `link-ea-club`
 * continuent d'appeler directement `_shared/ea.ts` (inchangé, zéro
 * régression) — cet adapter est le point d'entrée pour toute NOUVELLE Edge
 * Function qui a besoin de données EA normalisées.
 *
 * Seules 3 méthodes ont une implémentation réelle : searchClub et
 * getClubMatches réutilisent 1:1 les requêtes déjà en production dans
 * _shared/ea.ts (URLs/retries/timeout inchangés). getPlayerStats agrège les
 * résultats de getClubMatches via aggregatePlayerStats (normalize.ts),
 * unitairement testée (scripts/test-ea-normalize.ts) — mais AUCUNE des 3
 * n'a été exécutée contre un vrai payload EA depuis cette classe (seules
 * les requêtes réseau elles-mêmes, via ea-sync/link-ea-club, sont
 * éprouvées en prod ; le chemin de normalisation qui les enveloppe ici est
 * neuf). Les 6 autres méthodes lèvent NotImplementedError — voir
 * provider.ts et la règle 44 de la mission ("ne jamais faire du fake").
 */
export class ProClubsEAProvider implements EAProvider {
  readonly name = "proclubs-community" as const;

  async searchClub(clubName: string, platform: string = DEFAULT_PLATFORM): Promise<EAClub | null> {
    if (!FEATURE_EA_STATS) return null;
    try {
      const raw = await eaGet<any>(
        `/allTimeLeaderboard/search?platform=${encodeURIComponent(platform)}&clubName=${encodeURIComponent(clubName)}`
      );
      const list = Array.isArray(raw) ? raw : (raw?.clubs ?? []);
      const first = list[0];
      const club = normalizeClub(first, this.name, platform);
      // Fallback : certains payloads de recherche n'incluent pas `name`
      // (seulement l'id) — on retombe sur le terme cherché plutôt que de
      // perdre le résultat, uniquement si un id exploitable existe.
      if (!club && first && typeof first === "object") {
        const withFallbackName = { ...first, name: (first as any).name ?? clubName };
        return normalizeClub(withFallbackName, this.name, platform);
      }
      return club;
    } catch (err) {
      console.warn("[ea-provider] searchClub a échoué, fallback null:", err);
      return null;
    }
  }

  async getClub(_clubId: string, _platform?: string): Promise<EAClub | null> {
    throw new NotImplementedError("getClub");
  }

  async getClubStats(_clubId: string, _platform?: string): Promise<EAClubStats | null> {
    throw new NotImplementedError("getClubStats");
  }

  async getClubMatches(clubId: string, platform: string = DEFAULT_PLATFORM): Promise<EAMatch[] | null> {
    if (!FEATURE_EA_STATS) return null;
    try {
      const [league, friendly] = await Promise.all([
        eaGet<any[]>(
          `/clubs/matches?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}&matchType=leagueMatch&maxResultCount=10`
        ),
        eaGet<any[]>(
          `/clubs/matches?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}&matchType=friendlyMatch&maxResultCount=10`
        ),
      ]);
      const rawMatches = [...(league ?? []), ...(friendly ?? [])];
      const matches = rawMatches
        .map((m) => normalizeMatch(m, clubId, this.name, platform))
        .filter((m): m is EAMatch => m !== null);
      return matches;
    } catch (err) {
      console.warn(`[ea-provider] getClubMatches(${clubId}) a échoué, fallback null:`, err);
      return null;
    }
  }

  async getClubMembers(_clubId: string, _platform?: string): Promise<EAPlayer[] | null> {
    throw new NotImplementedError("getClubMembers");
  }

  async getPlayerStats(clubId: string, playerName: string, platform: string = DEFAULT_PLATFORM): Promise<EAPlayerStats | null> {
    const matches = await this.getClubMatches(clubId, platform);
    if (!matches) return null;
    return aggregatePlayerStats(matches, playerName, this.name, clubId, platform);
  }

  async getPlayerCareerStats(_playerName: string, _platform?: string): Promise<EAPlayerCareerStats | null> {
    throw new NotImplementedError("getPlayerCareerStats");
  }

  async getLeaderboard(_platform?: string): Promise<EALeaderboardEntry[] | null> {
    throw new NotImplementedError("getLeaderboard");
  }

  async getPlayoffData(_clubId: string, _platform?: string): Promise<EAPlayoffData | null> {
    throw new NotImplementedError("getPlayoffData");
  }
}

/** Instance partagée — Deno réutilise le module chargé, pas besoin de pool. */
export const eaProvider: EAProvider = new ProClubsEAProvider();

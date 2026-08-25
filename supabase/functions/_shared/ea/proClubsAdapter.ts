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
import { aggregatePlayerStats, normalizeMatch, normalizeSearchResults } from "./normalize.ts";

const DEFAULT_PLATFORM = "common-gen5";

function asRawArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

/**
 * Implémentation concrète d'EAProvider pour les endpoints communautaires
 * proclubs.ea.com. NON officielle EA — voir provider.ts et _shared/ea.ts.
 *
 * Réutilise le client défensif (`eaGet`) : un seul fetch, pas de duplication.
 * `link-ea-club` et `ea-sync` passent par cet adapter (searchClub /
 * getClubMatches), puis normalize → DB. Stubs : NotImplementedError, jamais
 * d'appel /clubs/info, overallStats, members, career, playoffs.
 */
export class ProClubsEAProvider implements EAProvider {
  readonly name = "proclubs-community" as const;

  async searchClub(clubName: string, platform: string = DEFAULT_PLATFORM): Promise<EAClub[] | null> {
    if (!FEATURE_EA_STATS) return null;
    try {
      const raw = await eaGet<unknown>(
        `/allTimeLeaderboard/search?platform=${encodeURIComponent(platform)}&clubName=${encodeURIComponent(clubName)}`
      );
      return normalizeSearchResults(raw, this.name, platform, clubName);
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
        eaGet<unknown>(
          `/clubs/matches?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}&matchType=leagueMatch&maxResultCount=10`
        ),
        eaGet<unknown>(
          `/clubs/matches?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}&matchType=friendlyMatch&maxResultCount=10`
        ),
      ]);
      const rawMatches = [...asRawArray(league), ...asRawArray(friendly)];
      return rawMatches
        .map((m) => normalizeMatch(m, clubId, this.name, platform))
        .filter((m): m is EAMatch => m !== null);
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

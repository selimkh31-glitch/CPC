import { FEATURE_EA_STATS, eaGet } from "../ea.ts";
import { NotImplementedError, type EAProvider } from "./provider.ts";
import type {
  EAClub,
  EAClubStats,
  EALeaderboardEntry,
  EAMatch,
  EAMatchType,
  EAPlayer,
  EAPlayerCareerStats,
  EAPlayoffData,
} from "./types.ts";
import {
  normalizeCareerList,
  normalizeClub,
  normalizeClubStats,
  normalizeMatch,
  normalizeMemberList,
  normalizeSearchResults,
  pickClubInfoRecord,
  pickClubStatsRecord,
} from "./normalize.ts";
import { aggregatePlayerStats } from "./normalize.ts";

const DEFAULT_PLATFORM = "common-gen5";

const MATCH_TYPES: readonly EAMatchType[] = ["leagueMatch", "friendlyMatch", "playoffMatch"];

function asRawArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Adapter unofficial /api/fc. Réutilise eaGet (Node fetch, ou hop Node depuis Deno).
 * link-ea-club et ea-sync passent par ici. Identité joueur = playername, jamais un login persona.
 */
export class ProClubsEAProvider implements EAProvider {
  readonly name = "proclubs-community" as const;

  async searchClub(clubName: string, platform: string = DEFAULT_PLATFORM): Promise<EAClub[] | null> {
    if (!FEATURE_EA_STATS) return null;
    try {
      const raw = await eaGet<unknown>(
        `/allTimeLeaderboard/search?platform=${encode(platform)}&clubName=${encode(clubName)}`
      );
      return normalizeSearchResults(raw, this.name, platform, clubName);
    } catch (err) {
      console.warn("[ea-provider] searchClub a échoué, fallback null:", err);
      return null;
    }
  }

  async getClub(clubId: string, platform: string = DEFAULT_PLATFORM): Promise<EAClub | null> {
    if (!FEATURE_EA_STATS) return null;
    try {
      const raw = await eaGet<unknown>(`/clubs/info?platform=${encode(platform)}&clubIds=${encode(clubId)}`);
      const record = pickClubInfoRecord(raw, clubId);
      return normalizeClub(record, this.name, platform);
    } catch (err) {
      console.warn(`[ea-provider] getClub(${clubId}) a échoué, fallback null:`, err);
      return null;
    }
  }

  async getClubStats(clubId: string, platform: string = DEFAULT_PLATFORM): Promise<EAClubStats | null> {
    if (!FEATURE_EA_STATS) return null;
    try {
      const raw = await eaGet<unknown>(`/clubs/overallStats?platform=${encode(platform)}&clubIds=${encode(clubId)}`);
      const record = pickClubStatsRecord(raw, clubId);
      if (record == null) return null;
      return normalizeClubStats(record, clubId, this.name, platform);
    } catch (err) {
      console.warn(`[ea-provider] getClubStats(${clubId}) a échoué, fallback null:`, err);
      return null;
    }
  }

  async getClubMatches(clubId: string, platform: string = DEFAULT_PLATFORM): Promise<EAMatch[] | null> {
    if (!FEATURE_EA_STATS) return null;
    try {
      const results = await Promise.allSettled(
        MATCH_TYPES.map((matchType) =>
          eaGet<unknown>(
            `/clubs/matches?platform=${encode(platform)}&clubIds=${encode(clubId)}&matchType=${encode(matchType)}&maxResultCount=10`
          )
        )
      );
      const rawMatches: unknown[] = [];
      let anyOk = false;
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        anyOk = true;
        rawMatches.push(...asRawArray(result.value));
      }
      if (!anyOk) return null;
      return rawMatches.map((m) => normalizeMatch(m, clubId, this.name, platform)).filter((m): m is EAMatch => m !== null);
    } catch (err) {
      console.warn(`[ea-provider] getClubMatches(${clubId}) a échoué, fallback null:`, err);
      return null;
    }
  }

  async getClubMembers(clubId: string, platform: string = DEFAULT_PLATFORM): Promise<EAPlayer[] | null> {
    if (!FEATURE_EA_STATS) return null;
    try {
      const raw = await eaGet<unknown>(`/members/stats?platform=${encode(platform)}&clubId=${encode(clubId)}`);
      return normalizeMemberList(raw, clubId, this.name, platform);
    } catch (err) {
      console.warn(`[ea-provider] getClubMembers(${clubId}) a échoué, fallback null:`, err);
      return null;
    }
  }

  async getPlayerStats(clubId: string, playerName: string, platform: string = DEFAULT_PLATFORM) {
    const matches = await this.getClubMatches(clubId, platform);
    if (!matches) return null;
    return aggregatePlayerStats(matches, playerName, this.name, clubId, platform);
  }

  async getClubCareerStats(clubId: string, platform: string = DEFAULT_PLATFORM): Promise<EAPlayerCareerStats[] | null> {
    if (!FEATURE_EA_STATS) return null;
    try {
      const raw = await eaGet<unknown>(`/members/career/stats?platform=${encode(platform)}&clubId=${encode(clubId)}`);
      return normalizeCareerList(raw, clubId, this.name, platform);
    } catch (err) {
      console.warn(`[ea-provider] getClubCareerStats(${clubId}) a échoué, fallback null:`, err);
      return null;
    }
  }

  async getPlayerCareerStats(
    clubId: string,
    playerName: string,
    platform: string = DEFAULT_PLATFORM
  ): Promise<EAPlayerCareerStats | null> {
    const list = await this.getClubCareerStats(clubId, platform);
    if (!list) return null;
    const key = playerName.trim().toLowerCase();
    if (!key) return null;
    return list.find((row) => row.externalId.trim().toLowerCase() === key) ?? null;
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

import { aggregatePlayerStats } from "./normalize.ts";
import type { EAMatch, EAPlayerStats, EAProviderName } from "./types.ts";

/**
 * Forme JSON stockée dans `users.verified_stats` (colonne existante, pas de
 * nouvelle table). `importedMatchIds` sert au skip incrémental : un match
 * déjà agrégé n'est pas recompté. `noShowsDetected` reste 0 — l'endpoint
 * matches EA ne fournit pas ce champ.
 */
export interface VerifiedPlayerStats {
  goals: number;
  assists: number;
  cleanSheets: number;
  matchesPlayed: number;
  avgRating: number;
  matchesPlayedRecent: number;
  noShowsDetected: number;
  lastSyncedAt: string;
  importedMatchIds: string[];
}

export function readImportedMatchIds(stats: unknown): string[] {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return [];
  const raw = (stats as Record<string, unknown>).importedMatchIds;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Si `matchId` est présent et déjà importé, on saute. Un match sans id ne
 * peut pas être dédupliqué — il reste dans la fenêtre courante.
 */
export function filterNewMatches(matches: EAMatch[], importedMatchIds: readonly string[]): EAMatch[] {
  const known = new Set(importedMatchIds);
  return matches.filter((m) => !(m.matchId && known.has(m.matchId)));
}

export function collectMatchIds(matches: EAMatch[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    if (!m.matchId || seen.has(m.matchId)) continue;
    seen.add(m.matchId);
    out.push(m.matchId);
  }
  return out;
}

function playerAppearsInMatch(match: EAMatch, playerKey: string): boolean {
  for (const p of Object.values(match.players)) {
    if (p.name.trim().toLowerCase() === playerKey) return true;
  }
  return false;
}

function asPreviousStats(stats: unknown): VerifiedPlayerStats | null {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return null;
  const r = stats as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    goals: num(r.goals),
    assists: num(r.assists),
    cleanSheets: num(r.cleanSheets),
    matchesPlayed: num(r.matchesPlayed),
    avgRating: num(r.avgRating),
    matchesPlayedRecent: num(r.matchesPlayedRecent),
    noShowsDetected: 0,
    lastSyncedAt: typeof r.lastSyncedAt === "string" ? r.lastSyncedAt : "",
    importedMatchIds: readImportedMatchIds(stats),
  };
}

export function mergeVerifiedStats(
  previous: VerifiedPlayerStats | null,
  incoming: Pick<EAPlayerStats, "goals" | "assists" | "cleanSheets" | "matchesPlayed" | "avgRating">,
  newMatchIds: string[],
  nowIso: string
): VerifiedPlayerStats {
  const prevPlayed = previous?.matchesPlayed ?? 0;
  const newPlayed = incoming.matchesPlayed;
  const totalPlayed = prevPlayed + newPlayed;

  const prevHasRating = previous != null && prevPlayed > 0;
  const newHasRating = incoming.avgRating !== null && newPlayed > 0;
  const ratingWeight =
    (prevHasRating ? prevPlayed : 0) + (newHasRating ? newPlayed : 0);
  const avgRating =
    ratingWeight > 0
      ? ((prevHasRating ? previous!.avgRating * prevPlayed : 0) +
          (newHasRating ? incoming.avgRating! * newPlayed : 0)) /
        ratingWeight
      : 0;

  const imported = readImportedMatchIds(previous);
  const seen = new Set(imported);
  for (const id of newMatchIds) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    imported.push(trimmed);
  }

  return {
    goals: (previous?.goals ?? 0) + incoming.goals,
    assists: (previous?.assists ?? 0) + incoming.assists,
    cleanSheets: (previous?.cleanSheets ?? 0) + incoming.cleanSheets,
    matchesPlayed: totalPlayed,
    avgRating,
    matchesPlayedRecent: newPlayed,
    noShowsDetected: 0,
    lastSyncedAt: nowIso,
    importedMatchIds: imported,
  };
}

/**
 * Agrège les matchs *nouveaux* pour un joueur (égalité insensible à la casse
 * `username == playername`) et fusionne avec le cache précédent. `null` =
 * rien de nouveau à écrire (garder le cache).
 */
export function buildVerifiedStatsForPlayer(
  matches: EAMatch[],
  playerName: string,
  previousStats: unknown,
  provider: EAProviderName,
  clubId: string,
  platform: string | null,
  nowIso: string = new Date().toISOString()
): VerifiedPlayerStats | null {
  const imported = readImportedMatchIds(previousStats);
  const fresh = filterNewMatches(matches, imported);
  const incoming = aggregatePlayerStats(fresh, playerName, provider, clubId, platform);
  if (!incoming) return null;

  const playerKey = playerName.trim().toLowerCase();
  const counted = fresh.filter((m) => playerAppearsInMatch(m, playerKey));
  const newIds = collectMatchIds(counted);
  return mergeVerifiedStats(asPreviousStats(previousStats), incoming, newIds, nowIso);
}

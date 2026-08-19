/**
 * Module "Verified Stats" — client défensif pour les endpoints semi-publics
 * EA Pro Clubs (proclubs.ea.com/api/fc/...). NON officiels : pannes, SSL
 * intermittent, rate-limiting fréquents. Isolé ici (Edge Function only),
 * jamais appelé depuis l'app mobile. Désactivable via FEATURE_EA_STATS.
 *
 * Porté depuis lib/ea/ (version Next.js) — logique identique, adaptée à Deno.
 */

// Exportés (lecture seule) pour supabase/functions/_shared/ea/proClubsAdapter.ts —
// l'adapter EAProvider réutilise EXACTEMENT ce client défensif (retries,
// timeout, headers) plutôt que de le dupliquer. Aucune valeur ni logique
// changée ici, seule la visibilité (`export`) est ajoutée.
export const BASE_URL = "https://proclubs.ea.com/api/fc";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

export const REALISTIC_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  Referer: "https://www.ea.com/",
};

export const FEATURE_EA_STATS = Deno.env.get("FEATURE_EA_STATS") !== "false";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function eaGet<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: REALISTIC_HEADERS,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`EA API a répondu ${res.status} sur ${path}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) await sleep(300 * Math.pow(3, attempt));
    }
  }
  throw new Error(`Échec EA API après ${MAX_RETRIES + 1} tentatives sur ${path}: ${lastError}`);
}

export async function resolveEaClubId(clubName: string): Promise<string | null> {
  if (!FEATURE_EA_STATS) return null;
  try {
    const raw = await eaGet<any>(
      `/allTimeLeaderboard/search?platform=common-gen5&clubName=${encodeURIComponent(clubName)}`
    );
    const list = Array.isArray(raw) ? raw : raw?.clubs ?? [];
    const first = list[0];
    return first ? String(first.clubId ?? first.id ?? "") || null : null;
  } catch (err) {
    console.warn("[ea] resolveEaClubId a échoué, fallback null:", err);
    return null;
  }
}

export interface VerifiedPlayerStats {
  goals: number;
  assists: number;
  cleanSheets: number;
  matchesPlayed: number;
  avgRating: number;
  matchesPlayedRecent: number;
  noShowsDetected: number;
  lastSyncedAt: string;
}

async function fetchEaClubMatches(clubId: string, matchType: "leagueMatch" | "friendlyMatch") {
  const raw = await eaGet<any[]>(
    `/clubs/matches?platform=common-gen5&clubIds=${encodeURIComponent(clubId)}&matchType=${matchType}&maxResultCount=10`
  );
  return (raw ?? []).map((m: any) => {
    const rawPlayers: Record<string, any> = m.players?.[clubId] ?? {};
    const players: Record<string, { name: string; goals: number; assists: number; cleansheetsAny: number; rating: number }> = {};
    for (const [playerId, p] of Object.entries(rawPlayers)) {
      players[playerId] = {
        name: String((p as any).playername ?? (p as any).name ?? ""),
        goals: Number((p as any).goals ?? 0),
        assists: Number((p as any).assists ?? 0),
        cleansheetsAny: Number((p as any).cleansheetsAny ?? 0),
        rating: Number((p as any).rating ?? 0),
      };
    }
    return { players };
  });
}

/**
 * Agrège les stats vérifiées d'un club EA, par nom de joueur (en minuscules).
 * NOTE : l'API EA n'expose pas d'identifiant stable mappable à nos users.id —
 * le rapprochement se fait par égalité `username == playername EA` (best-effort).
 */
export async function fetchVerifiedClubStats(
  eaClubId: string
): Promise<Record<string, VerifiedPlayerStats> | null> {
  if (!FEATURE_EA_STATS) return null;
  try {
    const [league, friendly] = await Promise.all([
      fetchEaClubMatches(eaClubId, "leagueMatch"),
      fetchEaClubMatches(eaClubId, "friendlyMatch"),
    ]);
    const matches = [...league, ...friendly];
    const perPlayer: Record<string, VerifiedPlayerStats> = {};

    for (const match of matches) {
      for (const p of Object.values(match.players)) {
        const key = p.name.trim().toLowerCase();
        if (!key) continue;
        const acc =
          perPlayer[key] ??
          (perPlayer[key] = {
            goals: 0,
            assists: 0,
            cleanSheets: 0,
            matchesPlayed: 0,
            avgRating: 0,
            matchesPlayedRecent: 0,
            noShowsDetected: 0,
            lastSyncedAt: new Date().toISOString(),
          });
        acc.goals += p.goals;
        acc.assists += p.assists;
        acc.cleanSheets += p.cleansheetsAny;
        acc.matchesPlayed += 1;
        acc.matchesPlayedRecent += 1;
        acc.avgRating = (acc.avgRating * (acc.matchesPlayed - 1) + p.rating) / acc.matchesPlayed;
      }
    }
    return perPlayer;
  } catch (err) {
    console.warn(`[ea] fetchVerifiedClubStats(${eaClubId}) a échoué, fallback silencieux:`, err);
    return null;
  }
}

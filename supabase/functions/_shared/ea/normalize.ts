import type { EAClub, EAClubStats, EAMatch, EAMatchType, EAPlayer, EAPlayerMatchStats, EAPlayerStats, EAProviderName } from "./types.ts";

/**
 * EA RAW -> ADAPTER -> NORMALIZED CPC TYPES (mission section 7).
 *
 * Fonctions pures, défensives : le JSON EA n'est jamais garanti — un champ
 * absent, renommé, ou de type inattendu ne doit JAMAIS faire planter la
 * normalisation. Chaque champ est extrait individuellement avec un fallback
 * `null`/valeur neutre plutôt qu'un accès direct non gardé. Testé par
 * scripts/test-ea-normalize.ts (payloads partiels/malformés).
 */

function toStr(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** Comme `toStr`, mais accepte aussi un nombre (EA renvoie parfois `clubId`
 *  comme number selon l'endpoint/la forme de payload — jamais garanti). */
function toIdStr(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return toStr(v);
}

/**
 * EA `clubId` seulement — digits 1–16. Vide, texte, UUID, regionId/teamId
 * lus depuis d'autres clés → null. Incident 2026-09-19 : Clubs.zone
 * regionId 49552 n'est PAS le clubId EA 42450.
 */
export function parseEaClubId(value: unknown): string | null {
  const s = toIdStr(value);
  if (!s || !/^\d{1,16}$/.test(s)) return null;
  return s;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Club EA — `externalId` = champ `clubId` uniquement.
 * Jamais `regionId`, `teamId`, `crestAssetId`, `crestId`, ni `id` générique
 * (un `id` Clubs.zone / interne n'est pas un clubId EA).
 */
export function normalizeClub(raw: unknown, provider: EAProviderName, externalPlatform: string | null): EAClub | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const externalId = parseEaClubId(r.clubId);
  const name = toStr(r.name) ?? toStr(r.clubName);
  if (!externalId || !name) return null;
  const rowPlatform = toStr(r.platform) ?? toStr(r.externalPlatform) ?? externalPlatform;
  return {
    provider,
    externalId,
    externalPlatform: rowPlatform,
    syncedAt: new Date().toISOString(),
    name,
    crestId: toStr(r.crestId) ?? toStr(r.crestAssetId),
    rank: toNum(r.ranking) ?? toNum(r.rank),
    gamesPlayed: toNum(r.gamesPlayed),
  };
}

/**
 * Liste complète des clubs d'un payload de recherche — jamais `list[0]`
 * silencieux. Accepte un tableau racine ou `{ clubs: [...] }`. Entrées
 * inexploitables (pas d'id) ignorées, pas d'exception. `fallbackName` ne
 * s'applique qu'aux lignes qui ont un id mais pas de nom (terme cherché).
 */
export function normalizeSearchResults(
  raw: unknown,
  provider: EAProviderName,
  externalPlatform: string | null,
  fallbackName?: string
): EAClub[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    const clubs = (raw as Record<string, unknown>).clubs;
    if (Array.isArray(clubs)) list = clubs;
  }

  const out: EAClub[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    let club = normalizeClub(item, provider, externalPlatform);
    if (!club && fallbackName && item && typeof item === "object" && !Array.isArray(item)) {
      const r = item as Record<string, unknown>;
      club = normalizeClub({ ...r, name: r.name ?? r.clubName ?? fallbackName }, provider, externalPlatform);
    }
    if (!club || seen.has(club.externalId)) continue;
    seen.add(club.externalId);
    out.push(club);
  }
  return out;
}

/** Re-search confirm : l'id doit figurer dans les résultats du nom cherché. */
export function confirmClubInSearch(candidates: EAClub[], eaClubId: string): EAClub | null {
  const id = parseEaClubId(eaClubId);
  if (!id) return null;
  return candidates.find((c) => c.externalId === id) ?? null;
}

function asObjectList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.members)) return r.members;
  if (Array.isArray(r.memberList)) return r.memberList;
  return [];
}

/** Membres /members/stats — noms seulement, jamais un inventaire fictif. */
export function normalizeMember(
  raw: unknown,
  clubExternalId: string,
  provider: EAProviderName,
  externalPlatform: string | null
): EAPlayer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name = toStr(r.name) ?? toStr(r.playername);
  if (!name) return null;
  return {
    provider,
    externalId: clubExternalId,
    externalPlatform,
    syncedAt: new Date().toISOString(),
    name,
    proPosition: toStr(r.proPos) ?? toStr(r.favoritePosition) ?? toStr(r.proPosition),
  };
}

export function normalizeMemberList(
  raw: unknown,
  clubExternalId: string,
  provider: EAProviderName,
  externalPlatform: string | null
): EAPlayer[] {
  const out: EAPlayer[] = [];
  const seen = new Set<string>();
  for (const item of asObjectList(raw)) {
    const member = normalizeMember(item, clubExternalId, provider, externalPlatform);
    if (!member) continue;
    const key = member.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(member);
  }
  return out;
}

export function normalizeClubStats(
  raw: unknown,
  externalId: string,
  provider: EAProviderName,
  externalPlatform: string | null
): EAClubStats {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    provider,
    externalId,
    externalPlatform,
    syncedAt: new Date().toISOString(),
    wins: toNum(r.wins),
    losses: toNum(r.losses),
    draws: toNum(r.ties) ?? toNum(r.draws),
    titlesWon: toNum(r.titlesWon),
  };
}

export function normalizePlayerMatchStats(raw: unknown): EAPlayerMatchStats {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    name: toStr(r.playername) ?? toStr(r.name) ?? "",
    goals: toNum(r.goals) ?? 0,
    assists: toNum(r.assists) ?? 0,
    cleanSheetsAny: toNum(r.cleansheetsAny) ?? 0,
    rating: toNum(r.rating),
  };
}

const KNOWN_MATCH_TYPES: readonly EAMatchType[] = ["leagueMatch", "friendlyMatch", "playoffMatch"];

/**
 * Normalise un match EA brut pour un club donné. `raw.players` est indexé
 * par clubId — on ne garde que la branche du club demandé (jamais l'équipe
 * adverse). Retourne `null` si `raw` n'est même pas un objet exploitable.
 */
export function normalizeMatch(
  raw: unknown,
  clubExternalId: string,
  provider: EAProviderName,
  externalPlatform: string | null
): EAMatch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const playersByClub = (r.players && typeof r.players === "object" ? r.players : {}) as Record<string, unknown>;
  const rawPlayers = (playersByClub[clubExternalId] && typeof playersByClub[clubExternalId] === "object"
    ? playersByClub[clubExternalId]
    : {}) as Record<string, unknown>;

  const players: Record<string, EAPlayerMatchStats> = {};
  for (const [playerId, p] of Object.entries(rawPlayers)) {
    players[playerId] = normalizePlayerMatchStats(p);
  }

  const matchTypeRaw = toStr(r.matchType);
  const matchType: EAMatchType = (KNOWN_MATCH_TYPES as readonly string[]).includes(matchTypeRaw ?? "")
    ? (matchTypeRaw as EAMatchType)
    : "unknown";

  return {
    provider,
    externalId: clubExternalId,
    externalPlatform,
    syncedAt: new Date().toISOString(),
    matchId: toIdStr(r.matchId),
    matchType,
    timestamp: toStr(r.timestamp),
    players,
  };
}

/**
 * Agrège les stats d'UN joueur sur une liste de matchs déjà normalisés
 * (`EAMatch.players` est indexé par id EA brut, jamais par nom — voir
 * EAMatch.players ci-dessus — donc on doit chercher par VALEUR sur
 * `EAPlayerMatchStats.name`, jamais indexer directement par nom).
 *
 * Extraite en fonction pure et testée (scripts/test-ea-normalize.ts) suite à
 * un bug réel : `ProClubsEAProvider.getPlayerStats` indexait auparavant
 * `match.players[playerName.toLowerCase()]` directement, ce qui ne pouvait
 * jamais correspondre (la clé de `players` est un id EA, pas un nom) — la
 * méthode retournait donc toujours `null` en pratique, malgré son statut
 * "implémentée" dans le rapport de session précédent. Jamais exécutée
 * contre un vrai payload EA avant ce correctif.
 */
export function aggregatePlayerStats(
  matches: EAMatch[],
  playerName: string,
  provider: EAProviderName,
  externalId: string,
  externalPlatform: string | null
): EAPlayerStats | null {
  const key = playerName.trim().toLowerCase();
  if (!key) return null;

  let goals = 0;
  let assists = 0;
  let cleanSheets = 0;
  let matchesPlayed = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  for (const match of matches) {
    for (const p of Object.values(match.players)) {
      if (p.name.trim().toLowerCase() !== key) continue;
      goals += p.goals;
      assists += p.assists;
      cleanSheets += p.cleanSheetsAny;
      matchesPlayed += 1;
      if (p.rating !== null) {
        ratingSum += p.rating;
        ratingCount += 1;
      }
      // Un match ne peut compter qu'un seul joueur par nom recherché côté
      // club normalisé (EAMatch.players ne garde que la branche du club
      // demandé, voir normalizeMatch) — pas de double-comptage possible ici.
      break;
    }
  }

  if (matchesPlayed === 0) return null;

  return {
    provider,
    externalId,
    externalPlatform,
    syncedAt: new Date().toISOString(),
    goals,
    assists,
    cleanSheets,
    matchesPlayed,
    avgRating: ratingCount > 0 ? ratingSum / ratingCount : null,
  };
}

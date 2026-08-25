import type {
  EAClub,
  EAClubStats,
  EAMatch,
  EAMatchType,
  EAPlayer,
  EAPlayerCareerStats,
  EAPlayerMatchStats,
  EAPlayerStats,
  EAProviderName,
} from "./types.ts";

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

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Club EA — accepte les deux formes rencontrées dans les payloads de
 *  recherche (`{clubId,...}` ou `{id,...}`). Retourne `null` si les champs
 *  minimum exploitables (id + nom) sont absents plutôt qu'un objet à moitié
 *  vide qui laisserait croire à une donnée réelle. */
export function normalizeClub(raw: unknown, provider: EAProviderName, externalPlatform: string | null): EAClub | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const externalId = toIdStr(r.clubId) ?? toIdStr(r.id);
  const name = toStr(r.name) ?? toStr(r.clubName);
  if (!externalId || !name) return null;
  const kit =
    r.customKit && typeof r.customKit === "object" && !Array.isArray(r.customKit)
      ? (r.customKit as Record<string, unknown>)
      : null;
  return {
    provider,
    externalId,
    externalPlatform,
    syncedAt: new Date().toISOString(),
    name,
    crestId: toStr(r.crestId) ?? toStr(r.crestAssetId) ?? (kit ? toStr(kit.crestAssetId) : null),
  };
}

/** /clubs/info est un objet indexé par clubId. */
export function pickClubInfoRecord(raw: unknown, clubId: string): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r[clubId] != null) return r[clubId];
  for (const [key, value] of Object.entries(r)) {
    if (key === clubId || String(key) === String(clubId)) return value;
  }
  return null;
}

/** /clubs/overallStats : tableau, ou objet indexé, ou un seul objet. */
export function pickClubStatsRecord(raw: unknown, clubId: string): unknown {
  if (Array.isArray(raw)) {
    return (
      raw.find((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const id = toIdStr((item as Record<string, unknown>).clubId) ?? toIdStr((item as Record<string, unknown>).id);
        return id === clubId;
      }) ?? null
    );
  }
  if (raw && typeof raw === "object") {
    const keyed = pickClubInfoRecord(raw, clubId);
    if (keyed) return keyed;
    const r = raw as Record<string, unknown>;
    if (toIdStr(r.clubId) === clubId || toIdStr(r.id) === clubId) return raw;
  }
  return null;
}

function asObjectList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const members = (raw as Record<string, unknown>).members;
    if (Array.isArray(members)) return members;
  }
  return [];
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
  const id = eaClubId.trim();
  if (!id) return null;
  return candidates.find((c) => c.externalId === id) ?? null;
}

export function normalizeClubStats(
  raw: unknown,
  externalId: string,
  provider: EAProviderName,
  externalPlatform: string | null
): EAClubStats {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return {
    provider,
    externalId,
    externalPlatform,
    syncedAt: new Date().toISOString(),
    wins: toNum(r.wins),
    losses: toNum(r.losses),
    draws: toNum(r.ties) ?? toNum(r.draws),
    titlesWon: toNum(r.titlesWon),
    gamesPlayed: toNum(r.gamesPlayed),
  };
}

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
    gamesPlayed: toNum(r.gamesPlayed),
    goals: toNum(r.goals),
    assists: toNum(r.assists),
    ratingAve: toNum(r.ratingAve),
    proName: toStr(r.proName),
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

export function normalizeCareerMember(
  raw: unknown,
  clubExternalId: string,
  provider: EAProviderName,
  externalPlatform: string | null
): EAPlayerCareerStats | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name = toStr(r.name) ?? toStr(r.playername) ?? toStr(r.proName);
  if (!name) return null;
  return {
    provider,
    externalId: name,
    externalPlatform,
    syncedAt: new Date().toISOString(),
    proName: toStr(r.proName) ?? name,
    proOverall: toNum(r.proOverall),
    gamesPlayed: toNum(r.gamesPlayed),
    goals: toNum(r.goals),
    assists: toNum(r.assists),
    ratingAve: toNum(r.ratingAve),
    proPosition: toStr(r.proPos) ?? toStr(r.favoritePosition) ?? toStr(r.proPosition),
  };
}

export function normalizeCareerList(
  raw: unknown,
  clubExternalId: string,
  provider: EAProviderName,
  externalPlatform: string | null
): EAPlayerCareerStats[] {
  const out: EAPlayerCareerStats[] = [];
  const seen = new Set<string>();
  for (const item of asObjectList(raw)) {
    const row = normalizeCareerMember(item, clubExternalId, provider, externalPlatform);
    if (!row || seen.has(row.externalId.toLowerCase())) continue;
    seen.add(row.externalId.toLowerCase());
    out.push(row);
  }
  return out;
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

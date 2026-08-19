import type { EAClub, EAClubStats, EAMatch, EAMatchType, EAPlayerMatchStats, EAPlayerStats, EAProviderName } from "./types.ts";

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
  return {
    provider,
    externalId,
    externalPlatform,
    syncedAt: new Date().toISOString(),
    name,
    crestId: toStr(r.crestId) ?? toStr(r.crestAssetId),
  };
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
    matchId: toStr(r.matchId),
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

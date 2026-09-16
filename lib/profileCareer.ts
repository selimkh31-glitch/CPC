/**
 * Tuiles carrière du profil (Matchs / Buts / Passes / Note).
 *
 * Réel : `verified_stats` si USERNAME_EQUALITY, et/ou le comptage CPC.
 * DEV : mock 4-pack déterministe uniquement s'il n'existe rien de réel.
 * Jamais persisté. Jamais labellisé EA. Prod vide = aucune tuile (pas de « — »).
 * On ne mélange jamais DEV dans un pack réel.
 */
import { statsSourceLabel, normalizeEaIdentityKind, type EaIdentityKind } from "@/lib/statsSource";
import type { VerifiedStats } from "@/lib/types";

export const CAREER_TILE_KEYS = ["matches", "goals", "assists", "rating"] as const;
export type CareerTileKey = (typeof CAREER_TILE_KEYS)[number];
export type CareerTileSource = "EA" | "CPC" | "DEV";

export interface CareerTile {
  key: CareerTileKey;
  label: string;
  value: string;
  source: CareerTileSource;
  highlight?: boolean;
}

export const CAREER_TILE_LABELS: Record<CareerTileKey, string> = {
  matches: "Matchs",
  goals: "Buts",
  assists: "Passes",
  rating: "Note",
};

export const CAREER_DEV_CAPTION = "DEV — pas des stats EA";

const KEY_ORDER: Record<CareerTileKey, number> = {
  matches: 0,
  goals: 1,
  assists: 2,
  rating: 3,
};

function fnv1a(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickInRange(hash: number, salt: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = hi - lo + 1;
  const x = (Math.imul(hash ^ salt, 2654435761) >>> 0) % span;
  return lo + x;
}

function parseCareerCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function parseCareerRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 10) / 10;
}

function parseCpcMatches(value: unknown): number | null {
  const n = parseCareerCount(value);
  if (n === null || n <= 0) return null;
  return n;
}

function formatCount(n: number): string {
  return String(n);
}

function formatRating(n: number): string {
  return n.toFixed(1);
}

function sortCareerTiles(tiles: CareerTile[]): CareerTile[] {
  return [...tiles].sort((a, b) => KEY_ORDER[a.key] - KEY_ORDER[b.key]);
}

function eaTile(key: CareerTileKey, numeric: number): CareerTile {
  const isNote = key === "rating";
  return {
    key,
    label: CAREER_TILE_LABELS[key],
    value: isNote ? formatRating(numeric) : formatCount(numeric),
    source: "EA",
    highlight: isNote ? true : undefined,
  };
}

/** Chiffres carrière stockés seulement — ignore PAC/SHO. Pas de pad « — ». */
export function readStoredCareerTiles(verified: VerifiedStats | null | undefined): CareerTile[] {
  if (!verified) return [];
  const out: CareerTile[] = [];
  const matches = parseCareerCount(verified.matchesPlayed);
  if (matches !== null) out.push(eaTile("matches", matches));
  const goals = parseCareerCount(verified.goals);
  if (goals !== null) out.push(eaTile("goals", goals));
  const assists = parseCareerCount(verified.assists);
  if (assists !== null) out.push(eaTile("assists", assists));
  const rating = parseCareerRating(verified.avgRating);
  if (rating !== null) out.push(eaTile("rating", rating));
  return out;
}

/** Mock DEV 4-pack — déterministe, jamais écrit en base, jamais labellisé EA. */
export function buildDevCareerTiles(seed: string): CareerTile[] {
  const hash = fnv1a(seed.trim() || "cpc");
  const matches = pickInRange(hash, 17, 8, 42);
  const goals = pickInRange(hash, 31, 2, 28);
  const assists = pickInRange(hash, 53, 1, 18);
  const ratingTenths = pickInRange(hash, 71, 62, 88);
  const rating = ratingTenths / 10;
  return [
    { key: "matches", label: CAREER_TILE_LABELS.matches, value: formatCount(matches), source: "DEV" },
    { key: "goals", label: CAREER_TILE_LABELS.goals, value: formatCount(goals), source: "DEV" },
    { key: "assists", label: CAREER_TILE_LABELS.assists, value: formatCount(assists), source: "DEV" },
    {
      key: "rating",
      label: CAREER_TILE_LABELS.rating,
      value: formatRating(rating),
      source: "DEV",
      highlight: true,
    },
  ];
}

export function careerTilesCaption(tiles: CareerTile[]): string | null {
  if (tiles.length === 0) return null;
  const sources = new Set(tiles.map((t) => t.source));
  if (sources.has("DEV")) return CAREER_DEV_CAPTION;
  if (sources.size === 1 && sources.has("EA")) return statsSourceLabel("EA");
  if (sources.size === 1 && sources.has("CPC")) return statsSourceLabel("CPC");
  return null;
}

export function resolveCareerTiles(input: {
  verified?: VerifiedStats | null;
  identityKind?: EaIdentityKind | null;
  cpcMatchesPlayed?: number | null;
  isDev?: boolean;
  seed?: string;
}): CareerTile[] {
  const identity = normalizeEaIdentityKind(input.identityKind);
  const tiles: CareerTile[] = [];

  if (identity === "USERNAME_EQUALITY") {
    tiles.push(...readStoredCareerTiles(input.verified));
  }

  const cpc = parseCpcMatches(input.cpcMatchesPlayed);
  if (cpc !== null && !tiles.some((t) => t.key === "matches")) {
    tiles.push({
      key: "matches",
      label: CAREER_TILE_LABELS.matches,
      value: formatCount(cpc),
      source: "CPC",
    });
  }

  if (tiles.length > 0) return sortCareerTiles(tiles);

  const isDev = input.isDev ?? (typeof __DEV__ !== "undefined" && Boolean(__DEV__));
  if (isDev) return buildDevCareerTiles(input.seed ?? "cpc");
  return [];
}

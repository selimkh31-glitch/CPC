/**
 * Ligne Matchmaking club — langue code, rythme court, forme V/N/D, effectif.
 *
 * Réel gagne. DEV : forme 5 lettres (hash clubId) et effectif 5–11 si rien
 * de stocké. Prod vide = null. Jamais des stats EA.
 */
import { LANGUAGE_LABELS, LANGUAGES } from "@/lib/constants";

const LANGUAGE_SET = new Set<string>(LANGUAGES);
const FORM_LETTERS = ["V", "N", "D"] as const;
const FORM_RE = /^[VND]{1,10}$/;

export const LIVE_ROW_LEVEL: Record<"CASUAL" | "COMPETITIVE", "CHILL" | "COMP"> = {
  CASUAL: "CHILL",
  COMPETITIVE: "COMP",
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
  return lo + ((Math.imul(hash ^ salt, 2654435761) >>> 0) % span);
}

/** Premier code langue (FR), jamais le libellé « Français ». */
export function liveRowLanguage(languages: string[] | null | undefined): string | null {
  const first = (languages ?? []).find((l) => typeof l === "string" && l.trim());
  if (!first) return null;
  const raw = first.trim();
  const upper = raw.toUpperCase();
  if (LANGUAGE_SET.has(upper)) return upper;
  const fromLabel = LANGUAGES.find((code) => LANGUAGE_LABELS[code]?.toLowerCase() === raw.toLowerCase());
  return fromLabel ?? null;
}

/** CASUAL → CHILL, COMPETITIVE → COMP. */
export function liveRowLevel(level: string | null | undefined): string | null {
  if (level === "CASUAL") return LIVE_ROW_LEVEL.CASUAL;
  if (level === "COMPETITIVE") return LIVE_ROW_LEVEL.COMPETITIVE;
  return null;
}

export function parseClubForm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().toUpperCase();
  if (!FORM_RE.test(t)) return null;
  return t;
}

function buildDevForm(clubId: string): string {
  const hash = fnv1a(clubId.trim() || "cpc");
  let out = "";
  for (let i = 0; i < 5; i += 1) {
    out += FORM_LETTERS[pickInRange(hash, (i + 1) * 97, 0, 2)];
  }
  return out;
}

/** Forme V/N/D réelle, sinon mock DEV 5 lettres, sinon null. Jamais EA. */
export function resolveClubForm(input: {
  form?: string | null;
  isDev?: boolean;
  clubId?: string;
}): string | null {
  const real = parseClubForm(input.form);
  if (real) return real;
  const isDev = input.isDev ?? (typeof __DEV__ !== "undefined" && Boolean(__DEV__));
  if (isDev) return buildDevForm(input.clubId ?? "cpc");
  return null;
}

/** Effectif réel, sinon DEV 5–11, sinon null. */
export function resolveMemberCount(input: {
  memberCount?: number | null;
  isDev?: boolean;
  clubId?: string;
}): number | null {
  if (typeof input.memberCount === "number" && Number.isFinite(input.memberCount) && input.memberCount >= 0) {
    return Math.floor(input.memberCount);
  }
  const isDev = input.isDev ?? (typeof __DEV__ !== "undefined" && Boolean(__DEV__));
  if (isDev) return pickInRange(fnv1a((input.clubId ?? "cpc").trim() || "cpc"), 17, 5, 11);
  return null;
}

/** « FR · CHILL · 8 · VNDVV » — seulement les morceaux réels / résolus. */
export function formatLiveRowMeta(parts: {
  language?: string | null;
  level?: string | null;
  memberCount?: number | null;
  form?: string | null;
}): string | null {
  const bits: string[] = [];
  if (parts.language) bits.push(parts.language);
  if (parts.level) bits.push(parts.level);
  if (typeof parts.memberCount === "number" && Number.isFinite(parts.memberCount)) {
    bits.push(String(parts.memberCount));
  }
  if (parts.form) bits.push(parts.form);
  return bits.length ? bits.join(" · ") : null;
}

export function buildClubLiveRowMeta(input: {
  languages?: string[] | null;
  level?: string | null;
  memberCount?: number | null;
  form?: string | null;
  clubId: string;
  isDev?: boolean;
}): string | null {
  return formatLiveRowMeta({
    language: liveRowLanguage(input.languages),
    level: liveRowLevel(input.level),
    memberCount: resolveMemberCount({
      memberCount: input.memberCount,
      isDev: input.isDev,
      clubId: input.clubId,
    }),
    form: resolveClubForm({ form: input.form, isDev: input.isDev, clubId: input.clubId }),
  });
}

/**
 * Identité club auto-éditable — colonnes `public.clubs` que le owner peut
 * envoyer via `supabase.from("clubs").update` (RLS `clubs_update_owner`).
 *
 * RLS ligne : seul le owner (`auth.uid() = owner_id`) peut UPDATE la ligne.
 * MANAGER : non (pas de policy `clubs_update_manager`). Pas de grant
 * colonne-par-colonne : l'allowlist ici est la défense applicative.
 *
 * Pas de `clubs.platform` : cette colonne n'existe pas. La plateforme affichée
 * est celle du owner (`users.platform`), jamais inventée ni écrite ici.
 */
import { CLUB_LEVELS, LANGUAGES } from "@/lib/constants";
import type { ClubLevel } from "@/lib/types";

export const CLUB_OWNER_UPDATE_COLUMNS = [
  "name",
  "level",
  "languages",
  "description",
  "voice_link",
] as const;

export type ClubOwnerUpdateColumn = (typeof CLUB_OWNER_UPDATE_COLUMNS)[number];

/** Colonnes `clubs` (et champs inventés) interdites au client d'édition d'identité. */
export const CLUB_CLIENT_FORBIDDEN_COLUMNS = [
  "id",
  "owner_id",
  "ea_club_id",
  "formation",
  "created_at",
  "platform",
] as const;

export interface ClubIdentityPatch {
  name: string;
  level: ClubLevel;
  languages: string[];
  description: string | null;
  voice_link: string | null;
}

const ALLOWED = new Set<string>(CLUB_OWNER_UPDATE_COLUMNS);
const FORBIDDEN = new Set<string>(CLUB_CLIENT_FORBIDDEN_COLUMNS);
const LEVEL_SET = new Set<string>(CLUB_LEVELS);
const LANGUAGE_SET = new Set<string>(LANGUAGES);

export function isAllowedClubIdentityColumn(column: string): boolean {
  return ALLOWED.has(column) && !FORBIDDEN.has(column);
}

/**
 * Ne conserve que les colonnes d'identité autorisées. Toute clé interdite
 * (`owner_id`, `formation`, `ea_club_id`, …) ou inventée (`platform`) est
 * ignorée — elle n'apparaît pas dans le payload UPDATE.
 */
export function pickAllowedClubIdentityPatch(input: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN.has(key)) continue;
    if (!ALLOWED.has(key)) continue;
    if (value === undefined) continue;
    patch[key] = value;
  }
  return patch;
}

/** RLS `clubs_update_owner` : seul le owner peut éditer l'identité. MANAGER : non. */
export function canEditClubIdentity(
  ownerId: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return Boolean(ownerId && userId && ownerId === userId);
}

export type ClubIdentityValidation = { ok: true; patch: ClubIdentityPatch } | { ok: false; message: string };

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, arr) => arr.indexOf(value) === index);
}

/**
 * Validation alignée sur CreateClubForm : nom non vide, niveau CASUAL /
 * COMPETITIVE, au moins une langue connue. Description et vocal optionnels
 * (chaîne vide → null). Aucune validation de format d'URL (voice_link est
 * ouvert tel quel, voir VoiceLinkBlock).
 */
export function validateClubIdentity(input: Record<string, unknown>): ClubIdentityValidation {
  const picked = pickAllowedClubIdentityPatch(input);

  const name = typeof picked.name === "string" ? picked.name.trim() : "";
  if (!name) {
    return { ok: false, message: "Nom et au moins une langue sont requis." };
  }

  const level = typeof picked.level === "string" ? picked.level : "";
  if (!LEVEL_SET.has(level)) {
    return { ok: false, message: "Choisis le niveau du club." };
  }

  const languagesRaw = Array.isArray(picked.languages) ? picked.languages : [];
  const languages = uniqueStrings(
    languagesRaw.filter((l): l is string => typeof l === "string" && LANGUAGE_SET.has(l))
  );
  if (languages.length === 0) {
    return { ok: false, message: "Nom et au moins une langue sont requis." };
  }

  const descriptionRaw = typeof picked.description === "string" ? picked.description.trim() : "";
  const voiceRaw = typeof picked.voice_link === "string" ? picked.voice_link.trim() : "";

  return {
    ok: true,
    patch: {
      name,
      level: level as ClubLevel,
      languages,
      description: descriptionRaw || null,
      voice_link: voiceRaw || null,
    },
  };
}

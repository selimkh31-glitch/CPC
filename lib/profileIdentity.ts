/**
 * Identité Pro Clubs auto-éditable — colonnes `public.users` que le client
 * peut envoyer via `supabase.from("users").update` (RLS `users_update_self`).
 *
 * RLS ligne : le joueur peut UPDATE sa propre ligne entière (pas de grant
 * colonne-par-colonne sur `users`, contrairement à `notifications.read_at`).
 * L'allowlist ici est donc la défense applicative : on n'envoie JAMAIS les
 * colonnes serveur (fiabilité, stats EA, plan, identité EA).
 *
 * Pas de « player level » : cette colonne n'existe pas (le niveau CASUAL /
 * COMPETITIVE est une propriété de club, pas de joueur).
 */
import {
  LANGUAGES,
  PLATFORMS,
  PLAY_STYLES,
  POSITIONS,
  type PlatformCode,
  type PlayStyleCode,
  type PositionCode,
} from "@/lib/constants";
import type { UserRow } from "@/lib/types";

export const PROFILE_SELF_UPDATE_COLUMNS = [
  "username",
  "platform",
  "main_position",
  "secondary_positions",
  "play_style",
  "languages",
  "availability",
] as const;

export type ProfileSelfUpdateColumn = (typeof PROFILE_SELF_UPDATE_COLUMNS)[number];

/** Colonnes `users` interdites au client d'édition d'identité. */
export const PROFILE_CLIENT_FORBIDDEN_COLUMNS = [
  "id",
  "reliability_score",
  "verified_stats",
  "ea_identity_kind",
  "plan",
  "ea_club_linked",
  "current_streak",
  "best_streak",
  "badges",
  "applications_today",
  "applications_reset_at",
  "push_token",
  "created_at",
] as const;

export const AVAILABILITY_SLOTS = [
  { value: "weekday_evening", label: "Soir en semaine" },
  { value: "weekend", label: "Week-end" },
  { value: "daytime", label: "Journée" },
  { value: "late_night", label: "Tard le soir" },
] as const;

export const AVAILABILITY_SLOT_VALUES = AVAILABILITY_SLOTS.map((s) => s.value);
export type AvailabilitySlot = (typeof AVAILABILITY_SLOT_VALUES)[number];

export interface ProfileIdentityPatch {
  username: string;
  platform: PlatformCode;
  main_position: PositionCode;
  secondary_positions: PositionCode[];
  play_style: PlayStyleCode;
  languages: string[];
  availability: { slots: string[] };
}

const ALLOWED = new Set<string>(PROFILE_SELF_UPDATE_COLUMNS);
const FORBIDDEN = new Set<string>(PROFILE_CLIENT_FORBIDDEN_COLUMNS);
const PLATFORM_SET = new Set<string>(PLATFORMS);
const POSITION_SET = new Set<string>(POSITIONS);
const PLAY_STYLE_SET = new Set<string>(PLAY_STYLES);
const LANGUAGE_SET = new Set<string>(LANGUAGES);
const SLOT_SET = new Set<string>(AVAILABILITY_SLOT_VALUES);

export function isAllowedProfileIdentityColumn(column: string): boolean {
  return ALLOWED.has(column) && !FORBIDDEN.has(column);
}

/**
 * Ne conserve que les colonnes d'identité autorisées. Toute clé interdite
 * (reliability_score, plan, ea_identity_kind, …) ou inconnue (player_level)
 * est ignorée — elle n'apparaît pas dans le payload UPDATE.
 */
export function pickAllowedProfileIdentityPatch(
  input: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN.has(key)) continue;
    if (!ALLOWED.has(key)) continue;
    if (value === undefined) continue;
    patch[key] = value;
  }
  return patch;
}

export function availabilitySlotsFromUser(
  availability: UserRow["availability"] | null | undefined
): string[] {
  const raw = availability && typeof availability === "object" ? (availability as { slots?: unknown }).slots : null;
  if (!Array.isArray(raw)) return [];
  return raw.filter((slot): slot is string => typeof slot === "string" && SLOT_SET.has(slot));
}

export type ProfileIdentityValidation =
  | { ok: true; patch: ProfileIdentityPatch }
  | { ok: false; message: string };

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, arr) => arr.indexOf(value) === index);
}

/**
 * Validation alignée sur l'onboarding : username ≥ 3, plateforme / poste
 * principal / style requis, ≤ 2 postes secondaires distincts du principal,
 * au moins une langue, dispos optionnelles.
 */
export function validateProfileIdentity(input: Record<string, unknown>): ProfileIdentityValidation {
  const picked = pickAllowedProfileIdentityPatch(input);

  const username = typeof picked.username === "string" ? picked.username.trim() : "";
  if (username.length < 3) {
    return { ok: false, message: "Le username doit faire au moins 3 caractères." };
  }

  const platform = typeof picked.platform === "string" ? picked.platform : "";
  if (!PLATFORM_SET.has(platform)) {
    return { ok: false, message: "Choisis ta plateforme Pro Clubs." };
  }

  const mainPosition = typeof picked.main_position === "string" ? picked.main_position : "";
  if (!POSITION_SET.has(mainPosition)) {
    return { ok: false, message: "Choisis ton poste principal." };
  }

  const secondaryRaw = Array.isArray(picked.secondary_positions) ? picked.secondary_positions : [];
  const secondaryCandidates = uniqueStrings(
    secondaryRaw.filter((p): p is string => typeof p === "string")
  ).filter((p) => p !== mainPosition);
  if (secondaryCandidates.some((p) => !POSITION_SET.has(p))) {
    return { ok: false, message: "Poste secondaire invalide." };
  }
  if (secondaryCandidates.length > 2) {
    return { ok: false, message: "Tu peux indiquer jusqu'à 2 postes secondaires." };
  }
  const secondary = secondaryCandidates;

  const playStyle = typeof picked.play_style === "string" ? picked.play_style : "";
  if (!PLAY_STYLE_SET.has(playStyle)) {
    return { ok: false, message: "Choisis ton style de jeu." };
  }

  const languagesRaw = Array.isArray(picked.languages) ? picked.languages : [];
  const languages = uniqueStrings(languagesRaw.filter((l): l is string => typeof l === "string" && LANGUAGE_SET.has(l)));
  if (languages.length === 0) {
    return { ok: false, message: "Choisis au moins une langue." };
  }

  const availabilityRaw = picked.availability;
  let slots: string[] = [];
  if (availabilityRaw && typeof availabilityRaw === "object" && !Array.isArray(availabilityRaw)) {
    const maybeSlots = (availabilityRaw as { slots?: unknown }).slots;
    if (Array.isArray(maybeSlots)) {
      slots = uniqueStrings(maybeSlots.filter((s): s is string => typeof s === "string" && SLOT_SET.has(s)));
    }
  }

  return {
    ok: true,
    patch: {
      username,
      platform: platform as PlatformCode,
      main_position: mainPosition as PositionCode,
      secondary_positions: secondary as PositionCode[],
      play_style: playStyle as PlayStyleCode,
      languages,
      availability: { slots },
    },
  };
}

export type PositionSelection = {
  main_position: PositionCode;
  secondary_positions: PositionCode[];
};

export type PositionTapIntent = "tap" | "long-press";

function normalizeSecondary(
  main: PositionCode,
  secondary: readonly string[] | null | undefined
): PositionCode[] {
  const seen = new Set<string>();
  const out: PositionCode[] = [];
  for (const raw of secondary ?? []) {
    if (typeof raw !== "string" || raw === main || !POSITION_SET.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw as PositionCode);
    if (out.length === 2) break;
  }
  return out;
}

/**
 * Grille de postes inline (profil perso). Pas de navigation.
 * - tap vide → secondaire (max 2)
 * - tap secondaire → devient principal, l'ancien principal passe secondaire (cap 2)
 * - tap principal → no-op
 * - déjà 2 secondaires + tap vide → ce poste devient principal
 * - appui long sur un secondaire → le retire ; le principal ne se retire pas
 */
export function nextPositionsOnTap(
  current: { main_position: PositionCode; secondary_positions?: readonly PositionCode[] | null },
  tapped: PositionCode,
  intent: PositionTapIntent = "tap"
): PositionSelection | null {
  if (!POSITION_SET.has(tapped) || !POSITION_SET.has(current.main_position)) return null;
  const main = current.main_position;
  const secondary = normalizeSecondary(main, current.secondary_positions);

  if (intent === "long-press") {
    if (tapped === main) return null;
    if (!secondary.includes(tapped)) return null;
    return { main_position: main, secondary_positions: secondary.filter((p) => p !== tapped) };
  }

  if (tapped === main) return null;

  if (secondary.includes(tapped)) {
    const rest = secondary.filter((p) => p !== tapped);
    return {
      main_position: tapped,
      secondary_positions: normalizeSecondary(tapped, [main, ...rest]),
    };
  }

  if (secondary.length < 2) {
    return { main_position: main, secondary_positions: [...secondary, tapped] };
  }

  return {
    main_position: tapped,
    secondary_positions: normalizeSecondary(tapped, [main, ...secondary]),
  };
}

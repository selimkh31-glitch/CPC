/**
 * Club Card — builder unique (V1).
 *
 * Une seule normalisation : `buildClubCardData`. Les 3 densités visuelles
 * (FULL / COMPACT / MINI) consomment le même objet.
 *
 * Jamais inventer : OVR club, stats EA club, W-D-L fictif, classement,
 * effectif, % de compatibilité, saisons. Pas de `clubs.platform` — la
 * plateforme est celle du owner (`users.platform`) si elle est fournie.
 *
 * LIVE / postes recherchés / note / TTL : `ClubSession`, jamais la ligne Club.
 * W-D-L : uniquement depuis `match_results` avec `opponent_club_id` (même
 * scorer que compétitions / classement CPC). Sinon : omis, pas de 0-0-0.
 *
 * `lib/clubIdentity.ts` reste l'allowlist d'édition — pas un builder de carte.
 */
import { CLUB_LEVEL_LABELS, PLATFORM_LABELS } from "@/lib/constants";
import {
  clubActiveLiveSession,
  clubIdentityLine,
  clubLanguagesLine,
  clubOwnerPlatform,
  clubOwnerUsername,
  clubPublicHref,
} from "@/lib/clubProfile";
import { formatNeededPositionsLine } from "@/lib/sessionState";
import {
  computeCpcClubStandings,
  isCpcClubRankingResult,
} from "@/lib/rankings";
import type { LinkedMatchResultInput } from "@/lib/competitions";
import type { ClubLevel, ClubMemberRow, ClubRow, ClubSessionRow, Platform } from "@/lib/types";

export type ClubCardDensity = "mini" | "compact" | "full";
/** `standard` → compact, `hero` → full (aliases, même doctrine que PlayerCard). */
export type ClubCardVariant = ClubCardDensity | "standard" | "hero";
export type ClubCardState = "normal" | "selected";

export const CLUB_CARD_COPY = {
  fc27: "EA SPORTS FC 27 Pro Clubs",
  live: "LIVE",
  viewClub: "Voir le club",
  seeking: (line: string) => `Cherche ${line}`,
  eaLinked: "Club EA lié",
  eaLinkedHint: "Identité EA — pas des stats de club",
  eaUnlinked: "Club EA pas lié — pas de stats EA inventées.",
  membersOne: "1 membre",
  membersMany: (n: number) => `${n} membres`,
  recordLabel: "Bilan",
  pointsLabel: "Pts",
} as const;

export function resolveClubCardDensity(variant: ClubCardVariant = "compact"): ClubCardDensity {
  if (variant === "full" || variant === "hero") return "full";
  if (variant === "mini") return "mini";
  return "compact";
}

/** Champs Club réels — pas de platform / OVR / saison. */
export type ClubCardClubInput = Pick<ClubRow, "id" | "name"> &
  Partial<Pick<ClubRow, "level" | "description" | "languages" | "ea_club_id" | "formation" | "created_at" | "owner_id">>;

export interface ClubCardMatchRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

export interface ClubCardData {
  clubId: string;
  name: string;
  level: ClubLevel | null;
  ownerPlatform: Platform | null;
  ownerUsername: string | null;
  languages: string[];
  languagesLine: string | null;
  identityLine: string | null;
  description: string | null;
  /** Identité EA liée — jamais des stats EA club. */
  eaClubId: string | null;
  formation: string | null;

  live: boolean;
  liveNote: string | null;
  neededPositions: string[];
  neededLine: string | null;
  liveExpiresAt: string | null;
  /** Moteur déterministe (poste · plateforme). Jamais un %. */
  reason: string | null;

  /** `null` si les membres ne sont pas déjà dans le payload. */
  memberCount: number | null;
  /** `null` sans résultats `opponent_club_id` — jamais 0-0-0 de remplissage. */
  matchRecord: ClubCardMatchRecord | null;

  href: string;
}

export interface BuildClubCardOpts {
  ownerPlatform?: Platform | null;
  ownerUsername?: string | null;
  live?: boolean;
  liveNote?: string | null;
  neededPositions?: readonly string[] | null;
  liveExpiresAt?: string | null;
  reason?: string | null;
  memberCount?: number | null;
  matchRecord?: ClubCardMatchRecord | null;
  sessionId?: string | null;
}

function isClubLevel(value: unknown): value is ClubLevel {
  return value === "CASUAL" || value === "COMPETITIVE";
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/** Refuse un % de compatibilité inventé — la reason LIVE est déterministe. */
export function honestClubReason(reason: string | null | undefined): string | null {
  const t = trimOrNull(reason);
  if (!t) return null;
  if (t.includes("%")) return null;
  return t;
}

export function normalizeClubMatchRecord(
  raw: ClubCardMatchRecord | null | undefined
): ClubCardMatchRecord | null {
  if (!raw) return null;
  const played = typeof raw.played === "number" && Number.isFinite(raw.played) ? Math.floor(raw.played) : 0;
  if (played <= 0) return null;
  const wins = typeof raw.wins === "number" && Number.isFinite(raw.wins) ? Math.max(0, Math.floor(raw.wins)) : 0;
  const draws = typeof raw.draws === "number" && Number.isFinite(raw.draws) ? Math.max(0, Math.floor(raw.draws)) : 0;
  const losses = typeof raw.losses === "number" && Number.isFinite(raw.losses) ? Math.max(0, Math.floor(raw.losses)) : 0;
  const points = typeof raw.points === "number" && Number.isFinite(raw.points) ? Math.max(0, Math.floor(raw.points)) : 0;
  return { played, wins, draws, losses, points };
}

/**
 * Bilan honnête : même scorer que le classement CPC. Lignes sans
 * `opponent_club_id` ignorées. Club absent du standing → null (pas 0-0-0).
 */
export function clubMatchRecordFromLinkedResults(
  clubId: string,
  results: readonly LinkedMatchResultInput[] | null | undefined
): ClubCardMatchRecord | null {
  if (!clubId || !results?.length) return null;
  if (!results.some(isCpcClubRankingResult)) return null;
  const row = computeCpcClubStandings(results).find((s) => s.clubId === clubId);
  return normalizeClubMatchRecord(row ?? null);
}

export function formatClubMatchRecord(record: ClubCardMatchRecord | null | undefined): string | null {
  const r = normalizeClubMatchRecord(record);
  if (!r) return null;
  return `${r.wins}V · ${r.draws}N · ${r.losses}D`;
}

export function formatClubMemberCount(count: number | null | undefined): string | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return null;
  const n = Math.floor(count);
  return n === 1 ? CLUB_CARD_COPY.membersOne : CLUB_CARD_COPY.membersMany(n);
}

function identityLineFor(level: ClubLevel | null, ownerPlatform: Platform | null): string | null {
  if (level) return clubIdentityLine({ level, ownerPlatform });
  if (ownerPlatform) return PLATFORM_LABELS[ownerPlatform];
  return null;
}

export function buildClubCardData(club: ClubCardClubInput, opts: BuildClubCardOpts = {}): ClubCardData {
  const level = isClubLevel(club.level) ? club.level : null;
  const ownerPlatform = opts.ownerPlatform ?? null;
  const live = Boolean(opts.live);
  const needed = live && Array.isArray(opts.neededPositions) ? [...opts.neededPositions].filter(Boolean) : [];

  return {
    clubId: club.id,
    name: club.name?.trim() ?? "",
    level,
    ownerPlatform,
    ownerUsername: trimOrNull(opts.ownerUsername),
    languages: Array.isArray(club.languages) ? club.languages.filter(Boolean) : [],
    languagesLine: clubLanguagesLine(club.languages),
    identityLine: identityLineFor(level, ownerPlatform),
    description: trimOrNull(club.description),
    eaClubId: trimOrNull(club.ea_club_id),
    formation: trimOrNull(club.formation),

    live,
    liveNote: live ? trimOrNull(opts.liveNote) : null,
    neededPositions: needed,
    neededLine: live ? formatNeededPositionsLine(needed) : null,
    liveExpiresAt: live ? trimOrNull(opts.liveExpiresAt) : null,
    reason: honestClubReason(opts.reason),

    memberCount:
      typeof opts.memberCount === "number" && Number.isFinite(opts.memberCount) && opts.memberCount >= 0
        ? Math.floor(opts.memberCount)
        : null,
    matchRecord: normalizeClubMatchRecord(opts.matchRecord ?? null),

    href: clubPublicHref(club.id, opts.sessionId),
  };
}

/** Session LIVE déjà hydratée — postes / note / TTL viennent de ClubSession. */
export function buildClubCardDataFromLiveSession(
  item: ClubSessionRow,
  opts: Pick<BuildClubCardOpts, "reason"> = {}
): ClubCardData | null {
  const club = item.club;
  if (!club) return null;
  return buildClubCardData(club, {
    ownerPlatform: club.owner?.platform ?? null,
    ownerUsername: club.owner?.username ?? null,
    live: true,
    liveNote: item.note,
    neededPositions: item.needed_positions,
    liveExpiresAt: item.expires_at,
    reason: opts.reason,
    sessionId: item.id,
  });
}

export function clubLevelLabel(level: ClubLevel | null | undefined): string | null {
  if (!level) return null;
  return CLUB_LEVEL_LABELS[level] ?? level;
}

/** Un chiffre héros CPC — points si un vrai bilan, sinon rien. */
export function clubCardHeroNumber(data: {
  matchRecord: ClubCardMatchRecord | null;
}): { value: number; label: string } | null {
  const record = normalizeClubMatchRecord(data.matchRecord);
  if (!record) return null;
  return { value: record.points, label: CLUB_CARD_COPY.pointsLabel };
}

/** Profil / effectif / feuille : membres + sessions déjà hydratés, pas de requête extra. */
export function buildClubCardDataFromHydratedClub(
  club: ClubCardClubInput,
  context: {
    members?: ClubMemberRow[] | null;
    sessions?: ClubSessionRow[] | null;
    nowMs: number;
  } & BuildClubCardOpts
): ClubCardData {
  const { members, sessions, nowMs, ...opts } = context;
  const live = clubActiveLiveSession(sessions, nowMs);
  return buildClubCardData(club, {
    ownerPlatform: opts.ownerPlatform ?? clubOwnerPlatform(members),
    ownerUsername: opts.ownerUsername ?? clubOwnerUsername(members),
    memberCount: opts.memberCount ?? (members ? members.length : null),
    live: opts.live ?? Boolean(live),
    liveNote: opts.liveNote ?? live?.note ?? null,
    neededPositions: opts.neededPositions ?? live?.needed_positions ?? null,
    liveExpiresAt: opts.liveExpiresAt ?? live?.expires_at ?? null,
    sessionId: opts.sessionId ?? live?.id ?? null,
    reason: opts.reason,
    matchRecord: opts.matchRecord,
  });
}

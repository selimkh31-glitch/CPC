/**
 * Player Card — builder unique + templates (V1).
 *
 * Une seule normalisation : `buildPlayerCardData`. Les 3 densités visuelles
 * (FULL / COMPACT / MINI) consomment le même objet. Ne jamais inventer
 * buts / passes / clean sheets / OVR EA / % de compatibilité.
 *
 * OVR CPC : `computeOvr` (fiabilité CPC seulement). Absent si pas de signal.
 * Stats EA : uniquement si `ea_identity_kind === USERNAME_EQUALITY` ET un
 * chiffre réel est stocké. Club EA lié ≠ id joueur EA vérifié.
 *
 * Share Card (plus tard) : ClubProCard / FULL réutilise déjà l'API Share
 * native. Pas d'usine virale, pas de configurateur type ClubsZone.
 */
import { computeOvr, rarityForOvr, OVR_CPC_LABEL, type Rarity } from "@/lib/ovr";
import { POSITION_LABELS } from "@/lib/constants";
import type { Plan, Platform, PlayStyleCode, PositionCode, UserRow, VerifiedStats } from "@/lib/types";
import type { EaIdentityKind } from "@/lib/statsSource";
import { hasVerifiedEaStatValues, normalizeEaIdentityKind } from "@/lib/statsSource";

export type PlayerCardDensity = "mini" | "compact" | "full";
/** `standard` → compact, `hero` → full (aliases historiques). */
export type PlayerCardVariant = PlayerCardDensity | "standard" | "hero";
export type PlayerCardState = "normal" | "featured" | "mvp" | "winner" | "selected";

export type PlayerCardTemplateId =
  | "STANDARD"
  | "COMPETITIVE"
  | "ELITE"
  | "TOURNAMENT"
  | "CHAMPION"
  | "LEGEND";

export type PlayerCardTemplateStatus = "FREE" | "PREMIUM" | "REWARD" | "LIMITED" | "LOCKED";

export interface PlayerCardTemplateDef {
  id: PlayerCardTemplateId;
  status: PlayerCardTemplateStatus;
  /** Seul STANDARD est sélectionnable. Le client ne peut pas déverrouiller le reste. */
  selectable: boolean;
}

export const PLAYER_CARD_TEMPLATES: Record<PlayerCardTemplateId, PlayerCardTemplateDef> = {
  STANDARD: { id: "STANDARD", status: "FREE", selectable: true },
  COMPETITIVE: { id: "COMPETITIVE", status: "LOCKED", selectable: false },
  ELITE: { id: "ELITE", status: "LOCKED", selectable: false },
  TOURNAMENT: { id: "TOURNAMENT", status: "LOCKED", selectable: false },
  CHAMPION: { id: "CHAMPION", status: "LOCKED", selectable: false },
  LEGEND: { id: "LEGEND", status: "LOCKED", selectable: false },
};

export const DEFAULT_PLAYER_CARD_TEMPLATE: PlayerCardTemplateId = "STANDARD";

export function isPlayerCardTemplateSelectable(id: PlayerCardTemplateId): boolean {
  return PLAYER_CARD_TEMPLATES[id].selectable && PLAYER_CARD_TEMPLATES[id].status === "FREE";
}

/**
 * Le client n'applique jamais un modèle LOCKED/PREMIUM. V1 = STANDARD pour
 * tout le monde ; un futur unlock vit côté serveur / RLS.
 */
export function resolvePlayerCardTemplate(
  requested?: PlayerCardTemplateId | null
): PlayerCardTemplateDef {
  if (requested && isPlayerCardTemplateSelectable(requested)) {
    return PLAYER_CARD_TEMPLATES[requested];
  }
  return PLAYER_CARD_TEMPLATES.STANDARD;
}

export function resolvePlayerCardDensity(variant: PlayerCardVariant = "compact"): PlayerCardDensity {
  if (variant === "full" || variant === "hero") return "full";
  if (variant === "mini") return "mini";
  return "compact";
}

export const PLAYER_CARD_COPY = {
  ovrLabel: OVR_CPC_LABEL,
  noMatch: "Pas encore de match enregistré",
  noBadges: "Aucun badge pour l'instant",
  needFitPrimary: "Poste correspondant",
  needFitSecondary: "Poste secondaire correspondant",
  viewProfile: "Voir le profil",
  invite: "Inviter",
  live: "LIVE",
  matchesOne: "1 match CPC",
  matchesMany: (n: number) => `${n} matchs CPC`,
  eaUsernameHint: "Pseudo EA (rapprochement par nom — pas un id joueur)",
  fc27: "EA SPORTS FC 27 Pro Clubs",
  linkClub: "Lier mon club",
  eaUnlinked: "Club EA pas lié. Tes chiffres CPC restent là — lier accélère la collecte FC 27.",
  eaLinkedPending: "Club EA lié — stats pas encore arrivées.",
  eaGoals: "Buts EA",
  eaAssists: "Passes EA",
  eaMatches: "Matchs EA",
  eaRating: "Note EA",
} as const;

export function formatCpcMatchCount(played: number | null | undefined): string | null {
  if (typeof played !== "number" || !Number.isFinite(played) || played <= 0) return null;
  return played === 1 ? PLAYER_CARD_COPY.matchesOne : PLAYER_CARD_COPY.matchesMany(played);
}

/** Badges CPC réellement persistés (streak via submit-review). Pas de saison inventée. */
export const CPC_BADGE_LABELS: Record<string, string> = {
  streak_5: "Fiable x5",
  streak_10: "Pilier x10",
  streak_25: "Légende x25",
};

export function visibleCpcBadges(stored: unknown): { id: string; label: string }[] {
  if (!Array.isArray(stored)) return [];
  const seen = new Set<string>();
  const out: { id: string; label: string }[] = [];
  for (const raw of stored) {
    if (typeof raw !== "string" || seen.has(raw)) continue;
    const label = CPC_BADGE_LABELS[raw];
    if (!label) continue;
    seen.add(raw);
    out.push({ id: raw, label });
  }
  return out;
}

/**
 * Fit honnête (règle déterministe poste ∈ besoin). Jamais un pourcentage.
 * `null` si le poste ne correspond pas — on n'invente pas de "compatibilité".
 */
export function playerNeedFitLabel(
  main: string,
  secondary: readonly string[] | undefined,
  needed: string | readonly string[] | null | undefined
): string | null {
  if (needed == null) return null;
  const list = (Array.isArray(needed) ? needed : [needed]).filter(Boolean);
  if (list.length === 0) return null;
  if (list.includes(main)) return PLAYER_CARD_COPY.needFitPrimary;
  if ((secondary ?? []).some((p) => list.includes(p))) return PLAYER_CARD_COPY.needFitSecondary;
  return null;
}

export interface PlayerCardData {
  userId: string;
  username: string;
  /** Pseudo utilisé pour le rapprochement EA — seulement si USERNAME_EQUALITY. */
  eaUsername: string | null;
  platform: Platform;
  mainPosition: PositionCode;
  secondaryPositions: PositionCode[];
  playStyle: PlayStyleCode;
  plan: Plan;
  clubName: string | null;
  clubId: string | null;

  /** `null` si pas assez de signal CPC — ne pas afficher un 45 décoratif. */
  ovr: number | null;
  rarity: Rarity | null;
  reliabilityScore: number;
  currentStreak: number;
  badges: { id: string; label: string }[];

  /** Club EA lié (colonne). ≠ identité joueur EA vérifiée. */
  eaClubLinked: boolean;
  eaIdentityKind: EaIdentityKind;
  eaStats: VerifiedStats | null;
  showEaStats: boolean;

  /** Comptage PRESENT → match_results. `null` = non fourni (listes). 0 = aucun. */
  cpcMatchesPlayed: number | null;
  live: boolean;
  liveNote: string | null;
  /** « Poste correspondant » — jamais un %. */
  needFitLabel: string | null;

  templateId: PlayerCardTemplateId;
  templateStatus: PlayerCardTemplateStatus;
}

export interface BuildPlayerCardOpts {
  clubName?: string | null;
  clubId?: string | null;
  live?: boolean;
  liveNote?: string | null;
  cpcMatchesPlayed?: number | null;
  needPositions?: string | readonly string[] | null;
  /** Ignoré s'il n'est pas STANDARD / sélectionnable. */
  templateId?: PlayerCardTemplateId | null;
}

export function buildPlayerCardData(user: UserRow, opts: BuildPlayerCardOpts = {}): PlayerCardData {
  const reliability = typeof user.reliability_score === "number" && Number.isFinite(user.reliability_score)
    ? user.reliability_score
    : 0;
  const ovr = computeOvr({ reliabilityScore: reliability, verifiedStats: user.verified_stats });
  const identityKind = normalizeEaIdentityKind(user.ea_identity_kind);
  const showEaStats = identityKind === "USERNAME_EQUALITY" && hasVerifiedEaStatValues(user.verified_stats);
  const template = resolvePlayerCardTemplate(opts.templateId);
  const played =
    typeof opts.cpcMatchesPlayed === "number" && Number.isFinite(opts.cpcMatchesPlayed)
      ? Math.max(0, Math.floor(opts.cpcMatchesPlayed))
      : null;

  return {
    userId: user.id,
    username: user.username,
    eaUsername: identityKind === "USERNAME_EQUALITY" && user.username ? user.username : null,
    platform: user.platform,
    mainPosition: user.main_position,
    secondaryPositions: user.secondary_positions ?? [],
    playStyle: user.play_style,
    plan: user.plan,
    clubName: opts.clubName?.trim() ? opts.clubName.trim() : null,
    clubId: opts.clubId?.trim() ? opts.clubId.trim() : null,

    ovr,
    rarity: ovr !== null ? rarityForOvr(ovr) : null,
    reliabilityScore: reliability,
    currentStreak: user.current_streak ?? 0,
    badges: visibleCpcBadges(user.badges),

    eaClubLinked: Boolean(user.ea_club_linked),
    eaIdentityKind: identityKind,
    eaStats: showEaStats ? user.verified_stats : null,
    showEaStats,

    cpcMatchesPlayed: played,
    live: Boolean(opts.live),
    liveNote: opts.liveNote?.trim() ? opts.liveNote.trim() : null,
    needFitLabel: playerNeedFitLabel(user.main_position, user.secondary_positions, opts.needPositions),

    templateId: template.id,
    templateStatus: template.status,
  };
}

/** Postes en une ligne (pas un mur de chips) — principal + secondaires uniques. */
export function formatPositionsLine(main: PositionCode, secondary: PositionCode[] = []): string {
  const positions = [main, ...secondary].filter((p, i, arr) => arr.indexOf(p) === i);
  return positions.map((p) => `${p} · ${POSITION_LABELS[p]}`).join("  ·  ");
}

/**
 * Blocs EA à afficher — seulement les chiffres déjà stockés.
 * Pas de SHO/PAS/TAC : ces % ne sont pas dans `verified_stats`.
 * Pas de courbe : une note unique n'est pas un historique.
 */
export function visibleEaStatBlocks(
  stats: VerifiedStats | null | undefined
): { label: string; value: string | number }[] {
  if (!stats) return [];
  const out: { label: string; value: string | number }[] = [];
  if (typeof stats.goals === "number" && Number.isFinite(stats.goals)) {
    out.push({ label: PLAYER_CARD_COPY.eaGoals, value: stats.goals });
  }
  if (typeof stats.assists === "number" && Number.isFinite(stats.assists)) {
    out.push({ label: PLAYER_CARD_COPY.eaAssists, value: stats.assists });
  }
  if (typeof stats.matchesPlayed === "number" && Number.isFinite(stats.matchesPlayed)) {
    out.push({ label: PLAYER_CARD_COPY.eaMatches, value: stats.matchesPlayed });
  }
  if (typeof stats.avgRating === "number" && Number.isFinite(stats.avgRating) && stats.avgRating > 0) {
    out.push({ label: PLAYER_CARD_COPY.eaRating, value: stats.avgRating.toFixed(1) });
  }
  return out;
}

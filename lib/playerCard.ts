/**
 * Player Card — normalisation des données d'affichage (mission section
 * 13-14, "PlayerCard doit être réutilisable dans profil, recherche joueur,
 * effectif, match, MVP, chat, groupes, ligues, tournois").
 *
 * Sépare explicitement (section 13, dernier paragraphe) :
 *   - métriques CPC (reliability, OVR, streak, badges, plan) — notre système,
 *   - stats EA (verified_stats) — source externe, jamais mélangée aux
 *     métriques CPC ni présentée comme si elle en faisait partie.
 *
 * `buildPlayerCardData` est LA fonction de normalisation unique : tout
 * consommateur de <PlayerCard> doit passer par elle plutôt que de construire
 * un PlayerCardData à la main (garantit un calcul d'OVR/rareté cohérent
 * partout, réutilise lib/ovr.ts sans le dupliquer).
 */
import { computeOvr, rarityForOvr, type Rarity } from "@/lib/ovr";
import { POSITION_LABELS } from "@/lib/constants";
import type { Plan, Platform, PlayStyleCode, PositionCode, UserRow, VerifiedStats } from "@/lib/types";
import type { EaIdentityKind } from "@/lib/statsSource";
import { normalizeEaIdentityKind } from "@/lib/statsSource";

export type PlayerCardVariant = "compact" | "standard" | "hero";
export type PlayerCardState = "normal" | "featured" | "mvp" | "winner" | "selected";

export interface PlayerCardData {
  userId: string;
  username: string;
  platform: Platform;
  mainPosition: PositionCode;
  secondaryPositions: PositionCode[];
  playStyle: PlayStyleCode;
  plan: Plan;
  clubName: string | null;

  /** --- CPC METRICS (notre système, jamais présenté comme venant d'EA) --- */
  ovr: number;
  rarity: Rarity;
  reliabilityScore: number;
  currentStreak: number;
  badges: string[];

  /** Club EA lié (stats éventuelles). ≠ identité joueur EA vérifiée. */
  verified: boolean;
  eaIdentityKind: EaIdentityKind;
  eaStats: VerifiedStats | null;
}

export function buildPlayerCardData(user: UserRow, opts: { clubName?: string | null } = {}): PlayerCardData {
  const ovr = computeOvr({ reliabilityScore: user.reliability_score, verifiedStats: user.verified_stats });
  return {
    userId: user.id,
    username: user.username,
    platform: user.platform,
    mainPosition: user.main_position,
    secondaryPositions: user.secondary_positions ?? [],
    playStyle: user.play_style,
    plan: user.plan,
    clubName: opts.clubName ?? null,

    ovr,
    rarity: rarityForOvr(ovr),
    reliabilityScore: user.reliability_score,
    currentStreak: user.current_streak ?? 0,
    badges: user.badges ?? [],

    verified: Boolean(user.ea_club_linked),
    eaIdentityKind: normalizeEaIdentityKind(user.ea_identity_kind),
    eaStats: user.verified_stats ?? null,
  };
}

/** Postes en une ligne (pas un mur de chips) — principal + secondaires uniques. */
export function formatPositionsLine(main: PositionCode, secondary: PositionCode[] = []): string {
  const positions = [main, ...secondary].filter((p, i, arr) => arr.indexOf(p) === i);
  return positions.map((p) => `${p} · ${POSITION_LABELS[p]}`).join("  ·  ");
}

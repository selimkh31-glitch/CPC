/**
 * SESSIONS + TEAMS — mapping honnête des champs déjà persistés.
 *
 * Pas d'enum OPEN/FULL/DRAFT inventé : `club_sessions` n'a que `is_live` +
 * `expires_at` (recrutement LIVE, même règle que lib/live.ts). Le match Pro
 * Clubs lancé vit dans `match_checkins` (actif tant qu'aucun `match_results`
 * n'est associé — voir useActiveMatchCheckin). Les deux peuvent coexister :
 * le check-in exige une session LIVE, ce n'est pas un statut unique.
 *
 * Effectif = `club_members` + `slot_assignments`. Jamais une 2e table roster.
 */
import type { PositionCode } from "@/lib/constants";
import { FORMATIONS, type FormationId } from "@/lib/formations";
import { findActiveLiveSession, type LiveSessionLike } from "@/lib/live";
import type { ClubMemberRow, ClubRole, MatchCheckinRow, SlotAssignmentRow } from "@/lib/types";

export const MATCH_SHEET_SLOT_TOTAL = 11;

export type LiveRecruitmentState =
  | { active: false }
  | {
      active: true;
      sessionId: string;
      expiresAt: string;
      neededPositions: PositionCode[];
      note: string | null;
    };

export type MatchSheetState =
  | { active: false }
  | {
      active: true;
      checkinId: string;
      launchedAt: string;
      formationId: string | null;
      sessionId: string;
    };

export interface ClubSessionSnapshot {
  live: LiveRecruitmentState;
  match: MatchSheetState;
}

export interface LiveSessionFields extends LiveSessionLike {
  id: string;
  needed_positions: PositionCode[] | string[];
  note: string | null;
}

/** Recrutement LIVE = flag + TTL futur. Jamais un is_live orphelin. */
export function mapLiveRecruitment(
  sessions: LiveSessionFields[] | null | undefined,
  nowMs: number
): LiveRecruitmentState {
  const session = findActiveLiveSession(sessions, nowMs);
  if (!session || !session.expires_at) return { active: false };
  return {
    active: true,
    sessionId: session.id,
    expiresAt: session.expires_at,
    neededPositions: session.needed_positions as PositionCode[],
    note: session.note,
  };
}

/**
 * Match lancé = check-in sans résultat. `null` (pas de ligne, ou déjà
 * finalisé) n'est PAS un statut inventé — c'est l'absence de check-in actif.
 */
export function mapMatchSheet(checkin: MatchCheckinRow | null | undefined): MatchSheetState {
  if (!checkin) return { active: false };
  return {
    active: true,
    checkinId: checkin.id,
    launchedAt: checkin.launched_at,
    formationId: checkin.formation_id,
    sessionId: checkin.session_id,
  };
}

export function clubSessionSnapshot(
  sessions: LiveSessionFields[] | null | undefined,
  checkin: MatchCheckinRow | null | undefined,
  nowMs: number
): ClubSessionSnapshot {
  return {
    live: mapLiveRecruitment(sessions, nowMs),
    match: mapMatchSheet(checkin),
  };
}

export function liveRecruitmentTitle(live: LiveRecruitmentState): string {
  return live.active ? "Recrutement LIVE" : "Hors ligne";
}

export function matchSheetTitle(match: MatchSheetState): string {
  return match.active ? "Match lancé" : "Pas de match lancé";
}

export interface NumberedPositionSlot {
  /** Clé d'affichage : CB, ou CB1/CB2/CB3 si le code est répété. */
  slot: string;
  /** Code brut pour le matching (toujours CB, jamais CB1). */
  code: string;
}

/**
 * Garde chaque slot. Un seul CB → « CB ». Trois CB → CB1, CB2, CB3.
 * Ne déduplique pas : une formation 5-3-2 a bien 3 CB.
 */
export function numberedPositionSlots(
  positions: readonly string[] | null | undefined
): NumberedPositionSlot[] {
  if (!positions?.length) return [];
  const counts = new Map<string, number>();
  for (const raw of positions) {
    const code = typeof raw === "string" ? raw.trim() : "";
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const out: NumberedPositionSlot[] = [];
  for (const raw of positions) {
    const code = typeof raw === "string" ? raw.trim() : "";
    if (!code) continue;
    const n = (seen.get(code) ?? 0) + 1;
    seen.set(code, n);
    const total = counts.get(code) ?? 1;
    out.push({ slot: total === 1 ? code : `${code}${n}`, code });
  }
  return out;
}

/** Codes uniques (ApplyForm : postuler en CB une fois, pas trois chips). */
export function uniquePositionCodes(positions: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of positions ?? []) {
    const code = typeof raw === "string" ? raw.trim() : "";
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** Une ligne de codes (CB1 · CB2 · ST). Vide -> null (jamais « — » inventé). */
export function formatNeededPositionsLine(positions: readonly string[] | null | undefined): string | null {
  const slots = numberedPositionSlots(positions);
  if (!slots.length) return null;
  return slots.map((item) => item.slot).join(" · ");
}

/** OWNER / MANAGER seulement — le frontend n'est pas la source de vérité (RLS / Edge). */
export function canMutateClub(role: ClubRole | null | undefined): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export function startingUserIds(assignments: SlotAssignmentRow[] | null | undefined): Set<string> {
  return new Set((assignments ?? []).map((a) => a.user_id));
}

/** Membres sans slot — banc dérivé, pas une table. */
export function benchMembers(
  members: ClubMemberRow[] | null | undefined,
  assignments: SlotAssignmentRow[] | null | undefined
): ClubMemberRow[] {
  const starters = startingUserIds(assignments);
  return (members ?? []).filter((m) => !starters.has(m.user_id));
}

/** Titulaires réellement placés (ligne slot_assignments), hors hydratation user. */
export function filledSlotCount(assignments: SlotAssignmentRow[] | null | undefined): number {
  return (assignments ?? []).length;
}

export function rosterFillLabel(filled: number, total = MATCH_SHEET_SLOT_TOTAL): string {
  return `${filled}/${total} titulaires`;
}

/**
 * Postes vraiment vacants sur la feuille — `needed_positions` du LIVE,
 * pas un second picker. Doublons conservés (deux CB vides = deux CB).
 */
export function neededPositionsFromEmptySlots(
  formationId: FormationId | null | undefined,
  assignments: SlotAssignmentRow[] | null | undefined
): PositionCode[] {
  if (!formationId) return [];
  const formation = FORMATIONS[formationId];
  if (!formation) return [];
  const filled = new Set((assignments ?? []).map((row) => row.slot_id));
  return formation.filter((slot) => !filled.has(slot.slotId)).map((slot) => slot.position);
}

/**
 * Slot vide du terrain : tappable seulement si un handler réel existe
 * (recherche / candidature). Sinon le "+" est une CTA morte — on le désactive.
 */
export function canPressEmptyFormationSlot(interactive: boolean, hasEmptySlotHandler: boolean): boolean {
  return interactive && hasEmptySlotHandler;
}

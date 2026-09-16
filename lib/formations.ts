import { POSITIONS, type PositionCode } from "./constants";

/**
 * Catalogue statique des formations (feuille de match, phase 1 — voir plan
 * validé). `Formation` est la source de vérité structurelle des 11 slots :
 * `club_sessions.needed_positions` n'en sera qu'une dérivation dans une phase
 * ultérieure, jamais une seconde source de vérité.
 *
 * `position` reste strictement l'un des 12 codes métier existants
 * (`PositionCode`, voir lib/constants.ts) — le matching joueur (main/secondary
 * position) n'est jamais modifié par ce catalogue. `slotId` porte uniquement
 * la distinction visuelle gauche/droite/centre (ex: deux slots `CB` côte à
 * côte dans un 4-3-3 sont `slotId` différents mais partagent `position: "CB"`).
 */
export interface FormationSlot {
  /** Unique dans la formation (pas globalement) — ex: "LCB", "RCB". */
  slotId: string;
  /** Code métier existant, utilisé pour le matching joueur ↔ slot. */
  position: PositionCode;
  /** Libellé d'affichage court sur le terrain. */
  label: string;
  /** 0 (gauche) → 100 (droite). */
  x: number;
  /** 0 (but adverse) → 100 (propre but). */
  y: number;
}

export const FORMATIONS = {
  "4-3-3": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LB", position: "LB", label: "LB", x: 15, y: 74 },
    { slotId: "LCB", position: "CB", label: "CB", x: 37, y: 80 },
    { slotId: "RCB", position: "CB", label: "CB", x: 63, y: 80 },
    { slotId: "RB", position: "RB", label: "RB", x: 85, y: 74 },
    { slotId: "CDM", position: "CDM", label: "CDM", x: 50, y: 60 },
    { slotId: "LCM", position: "CM", label: "CM", x: 30, y: 46 },
    { slotId: "RCM", position: "CM", label: "CM", x: 70, y: 46 },
    { slotId: "LW", position: "LW", label: "LW", x: 15, y: 20 },
    { slotId: "ST", position: "ST", label: "ST", x: 50, y: 10 },
    { slotId: "RW", position: "RW", label: "RW", x: 85, y: 20 },
  ],
  "4-4-2": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LB", position: "LB", label: "LB", x: 15, y: 74 },
    { slotId: "LCB", position: "CB", label: "CB", x: 37, y: 80 },
    { slotId: "RCB", position: "CB", label: "CB", x: 63, y: 80 },
    { slotId: "RB", position: "RB", label: "RB", x: 85, y: 74 },
    { slotId: "LM", position: "LM", label: "LM", x: 15, y: 46 },
    { slotId: "LCM", position: "CM", label: "CM", x: 37, y: 50 },
    { slotId: "RCM", position: "CM", label: "CM", x: 63, y: 50 },
    { slotId: "RM", position: "RM", label: "RM", x: 85, y: 46 },
    { slotId: "LST", position: "ST", label: "ST", x: 38, y: 12 },
    { slotId: "RST", position: "ST", label: "ST", x: 62, y: 12 },
  ],
  "4-1-2-1-2": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LB", position: "LB", label: "LB", x: 15, y: 74 },
    { slotId: "LCB", position: "CB", label: "CB", x: 37, y: 80 },
    { slotId: "RCB", position: "CB", label: "CB", x: 63, y: 80 },
    { slotId: "RB", position: "RB", label: "RB", x: 85, y: 74 },
    { slotId: "CDM", position: "CDM", label: "CDM", x: 50, y: 64 },
    { slotId: "LCM", position: "CM", label: "CM", x: 30, y: 48 },
    { slotId: "RCM", position: "CM", label: "CM", x: 70, y: 48 },
    { slotId: "CAM", position: "CAM", label: "CAM", x: 50, y: 32 },
    { slotId: "LST", position: "ST", label: "ST", x: 38, y: 12 },
    { slotId: "RST", position: "ST", label: "ST", x: 62, y: 12 },
  ],
  "4-2-3-1": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LB", position: "LB", label: "LB", x: 15, y: 74 },
    { slotId: "LCB", position: "CB", label: "CB", x: 37, y: 80 },
    { slotId: "RCB", position: "CB", label: "CB", x: 63, y: 80 },
    { slotId: "RB", position: "RB", label: "RB", x: 85, y: 74 },
    { slotId: "LDM", position: "CDM", label: "CDM", x: 35, y: 60 },
    { slotId: "RDM", position: "CDM", label: "CDM", x: 65, y: 60 },
    { slotId: "LAM", position: "LM", label: "LM", x: 15, y: 32 },
    { slotId: "CAM", position: "CAM", label: "CAM", x: 50, y: 30 },
    { slotId: "RAM", position: "RM", label: "RM", x: 85, y: 32 },
    { slotId: "ST", position: "ST", label: "ST", x: 50, y: 10 },
  ],
  "4-2-2-2": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LB", position: "LB", label: "LB", x: 15, y: 74 },
    { slotId: "LCB", position: "CB", label: "CB", x: 37, y: 80 },
    { slotId: "RCB", position: "CB", label: "CB", x: 63, y: 80 },
    { slotId: "RB", position: "RB", label: "RB", x: 85, y: 74 },
    { slotId: "LDM", position: "CDM", label: "CDM", x: 35, y: 60 },
    { slotId: "RDM", position: "CDM", label: "CDM", x: 65, y: 60 },
    { slotId: "LAM", position: "CAM", label: "CAM", x: 33, y: 34 },
    { slotId: "RAM", position: "CAM", label: "CAM", x: 67, y: 34 },
    { slotId: "LST", position: "ST", label: "ST", x: 38, y: 12 },
    { slotId: "RST", position: "ST", label: "ST", x: 62, y: 12 },
  ],
  "3-5-2": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LCB", position: "CB", label: "CB", x: 25, y: 78 },
    { slotId: "CB", position: "CB", label: "CB", x: 50, y: 82 },
    { slotId: "RCB", position: "CB", label: "CB", x: 75, y: 78 },
    { slotId: "LM", position: "LM", label: "LM", x: 10, y: 52 },
    { slotId: "LCM", position: "CM", label: "CM", x: 33, y: 50 },
    { slotId: "CDM", position: "CDM", label: "CDM", x: 50, y: 62 },
    { slotId: "RCM", position: "CM", label: "CM", x: 67, y: 50 },
    { slotId: "RM", position: "RM", label: "RM", x: 90, y: 52 },
    { slotId: "LST", position: "ST", label: "ST", x: 38, y: 12 },
    { slotId: "RST", position: "ST", label: "ST", x: 62, y: 12 },
  ],
  "3-4-3": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LCB", position: "CB", label: "CB", x: 25, y: 78 },
    { slotId: "CB", position: "CB", label: "CB", x: 50, y: 82 },
    { slotId: "RCB", position: "CB", label: "CB", x: 75, y: 78 },
    { slotId: "LM", position: "LM", label: "LM", x: 12, y: 50 },
    { slotId: "LCM", position: "CM", label: "CM", x: 37, y: 52 },
    { slotId: "RCM", position: "CM", label: "CM", x: 63, y: 52 },
    { slotId: "RM", position: "RM", label: "RM", x: 88, y: 50 },
    { slotId: "LW", position: "LW", label: "LW", x: 18, y: 16 },
    { slotId: "ST", position: "ST", label: "ST", x: 50, y: 10 },
    { slotId: "RW", position: "RW", label: "RW", x: 82, y: 16 },
  ],
  "5-3-2": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LWB", position: "LB", label: "LB", x: 8, y: 66 },
    { slotId: "LCB", position: "CB", label: "CB", x: 30, y: 80 },
    { slotId: "CB", position: "CB", label: "CB", x: 50, y: 84 },
    { slotId: "RCB", position: "CB", label: "CB", x: 70, y: 80 },
    { slotId: "RWB", position: "RB", label: "RB", x: 92, y: 66 },
    { slotId: "LCM", position: "CM", label: "CM", x: 30, y: 50 },
    { slotId: "CDM", position: "CDM", label: "CDM", x: 50, y: 58 },
    { slotId: "RCM", position: "CM", label: "CM", x: 70, y: 50 },
    { slotId: "LST", position: "ST", label: "ST", x: 38, y: 12 },
    { slotId: "RST", position: "ST", label: "ST", x: 62, y: 12 },
  ],
  "4-1-4-1": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LB", position: "LB", label: "LB", x: 15, y: 74 },
    { slotId: "LCB", position: "CB", label: "CB", x: 37, y: 80 },
    { slotId: "RCB", position: "CB", label: "CB", x: 63, y: 80 },
    { slotId: "RB", position: "RB", label: "RB", x: 85, y: 74 },
    { slotId: "CDM", position: "CDM", label: "CDM", x: 50, y: 62 },
    { slotId: "LM", position: "LM", label: "LM", x: 15, y: 42 },
    { slotId: "LCM", position: "CM", label: "CM", x: 37, y: 44 },
    { slotId: "RCM", position: "CM", label: "CM", x: 63, y: 44 },
    { slotId: "RM", position: "RM", label: "RM", x: 85, y: 42 },
    { slotId: "ST", position: "ST", label: "ST", x: 50, y: 10 },
  ],
  "4-4-1-1": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LB", position: "LB", label: "LB", x: 15, y: 74 },
    { slotId: "LCB", position: "CB", label: "CB", x: 37, y: 80 },
    { slotId: "RCB", position: "CB", label: "CB", x: 63, y: 80 },
    { slotId: "RB", position: "RB", label: "RB", x: 85, y: 74 },
    { slotId: "LM", position: "LM", label: "LM", x: 15, y: 48 },
    { slotId: "LCM", position: "CM", label: "CM", x: 37, y: 52 },
    { slotId: "RCM", position: "CM", label: "CM", x: 63, y: 52 },
    { slotId: "RM", position: "RM", label: "RM", x: 85, y: 48 },
    { slotId: "CAM", position: "CAM", label: "CAM", x: 50, y: 28 },
    { slotId: "ST", position: "ST", label: "ST", x: 50, y: 10 },
  ],
  "3-4-1-2": [
    { slotId: "GK", position: "GK", label: "GK", x: 50, y: 92 },
    { slotId: "LCB", position: "CB", label: "CB", x: 25, y: 78 },
    { slotId: "CB", position: "CB", label: "CB", x: 50, y: 82 },
    { slotId: "RCB", position: "CB", label: "CB", x: 75, y: 78 },
    { slotId: "LM", position: "LM", label: "LM", x: 12, y: 52 },
    { slotId: "LCM", position: "CM", label: "CM", x: 37, y: 54 },
    { slotId: "RCM", position: "CM", label: "CM", x: 63, y: 54 },
    { slotId: "RM", position: "RM", label: "RM", x: 88, y: 52 },
    { slotId: "CAM", position: "CAM", label: "CAM", x: 50, y: 32 },
    { slotId: "LST", position: "ST", label: "ST", x: 38, y: 10 },
    { slotId: "RST", position: "ST", label: "ST", x: 62, y: 10 },
  ],
} as const satisfies Record<string, readonly FormationSlot[]>;

export type FormationId = keyof typeof FORMATIONS;
export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];

export function isFormationId(value: string | null | undefined): value is FormationId {
  return Boolean(value && value in FORMATIONS);
}

/** Assignation minimale pour un remap — pas une ligne DB complète. */
export interface RemappableAssignment {
  slotId: string;
  userId: string;
}

/**
 * Recolle les titulaires sur une nouvelle formation sans toucher à club_members.
 *
 * 1. Même `slotId` encore présent → on le garde (prioritaire).
 * 2. Sinon, premier slot encore libre avec le **même code poste exact**
 *    (LW ≠ LM, RW ≠ RM — jamais d'approximation).
 * 3. Sinon on drop uniquement cette assignation.
 *
 * L'ordre d'entrée départage les collisions (deux ST pour un seul ST cible).
 */
export function remapSlotAssignments(
  assignments: readonly RemappableAssignment[],
  fromFormationId: FormationId,
  toFormationId: FormationId
): RemappableAssignment[] {
  const toSlots = FORMATIONS[toFormationId];
  const fromSlots = FORMATIONS[fromFormationId];
  const used = new Set<string>();
  const kept: RemappableAssignment[] = [];
  const pending: RemappableAssignment[] = [];
  const toSlotIds = new Set<string>(toSlots.map((slot) => slot.slotId));
  const fromBySlotId = new Map<string, (typeof fromSlots)[number]>(fromSlots.map((slot) => [slot.slotId, slot]));

  for (const assignment of assignments) {
    if (toSlotIds.has(assignment.slotId) && !used.has(assignment.slotId)) {
      used.add(assignment.slotId);
      kept.push({ slotId: assignment.slotId, userId: assignment.userId });
    } else {
      pending.push(assignment);
    }
  }

  if (fromFormationId === toFormationId) {
    return kept;
  }

  for (const assignment of pending) {
    const position = fromBySlotId.get(assignment.slotId)?.position;
    if (!position) continue;
    const target = toSlots.find((slot) => slot.position === position && !used.has(slot.slotId));
    if (!target) continue;
    used.add(target.slotId);
    kept.push({ slotId: target.slotId, userId: assignment.userId });
  }

  return kept;
}

// ------------------------------------------------------------------
// Validation dev-only : garantit l'intégrité du catalogue au chargement
// du module (11 slots exacts, slotId uniques, position valide, coords
// bornées). Ne s'exécute pas en production — coût nul pour l'app réelle.
// ------------------------------------------------------------------
function validateFormations() {
  const validPositions = new Set<string>(POSITIONS);

  for (const [formationId, slots] of Object.entries(FORMATIONS)) {
    if (slots.length !== 11) {
      throw new Error(`[formations] "${formationId}" doit avoir exactement 11 slots (trouvé: ${slots.length}).`);
    }

    const seenSlotIds = new Set<string>();
    for (const slot of slots) {
      if (seenSlotIds.has(slot.slotId)) {
        throw new Error(`[formations] "${formationId}" contient un slotId dupliqué: "${slot.slotId}".`);
      }
      seenSlotIds.add(slot.slotId);

      if (!validPositions.has(slot.position)) {
        throw new Error(`[formations] "${formationId}" > slot "${slot.slotId}" a une position invalide: "${slot.position}".`);
      }

      if (slot.x < 0 || slot.x > 100 || slot.y < 0 || slot.y > 100) {
        throw new Error(
          `[formations] "${formationId}" > slot "${slot.slotId}" a des coordonnées hors bornes (x=${slot.x}, y=${slot.y}), attendu 0-100.`
        );
      }
    }
  }
}

if (typeof __DEV__ !== "undefined" && __DEV__) {
  validateFormations();
}

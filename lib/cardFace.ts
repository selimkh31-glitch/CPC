/**
 * Attributs face PAC/SHO/PAS/DRI/DEF/PHY — plug réel + overlay DEV.
 *
 * Prod : uniquement si `USERNAME_EQUALITY` ET au moins un chiffre 0–99 stocké.
 * Pack incomplet : seulement les vrais nombres, jamais « — » ni remplissage DEV.
 * DEV : mock déterministe (hash du seed), jamais persisté, jamais labellisé EA.
 * On ne mélange jamais DEV dans un pack EA.
 */
import type { PositionCode } from "@/lib/constants";
import type { EaIdentityKind } from "@/lib/statsSource";
import type { VerifiedStats } from "@/lib/types";

export const FACE_STAT_KEYS = ["pac", "sho", "pas", "dri", "def", "phy"] as const;
export type FaceStatKey = (typeof FACE_STAT_KEYS)[number];
export type FaceStatsSource = "EA" | "DEV";
export type FaceStatsValues = Partial<Record<FaceStatKey, number>>;

export interface FaceStatsPack {
  source: FaceStatsSource;
  values: FaceStatsValues;
}

export const FACE_STAT_LABELS: Record<FaceStatKey, string> = {
  pac: "PAC",
  sho: "SHO",
  pas: "PAS",
  dri: "DRI",
  def: "DEF",
  phy: "PHY",
};

const FACE_DEV_CAPTION = "DEV — pas des stats EA";
const FACE_EA_CAPTION = "EA (club lié)";

export function faceStatsCaption(source: FaceStatsSource): string {
  return source === "DEV" ? FACE_DEV_CAPTION : FACE_EA_CAPTION;
}

export function parseFaceAttr(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 0 || n > 99) return null;
  return n;
}

/** Lit uniquement les attributs face stockés. Ignore career (buts / passes / note). */
export function readStoredFaceStats(verified: VerifiedStats | null | undefined): FaceStatsValues | null {
  if (!verified) return null;
  const values: FaceStatsValues = {};
  let any = false;
  for (const key of FACE_STAT_KEYS) {
    const n = parseFaceAttr(verified[key]);
    if (n === null) continue;
    values[key] = n;
    any = true;
  }
  return any ? values : null;
}

function fnv1a(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickInRange(hash: number, salt: number, min: number, max: number): number {
  const lo = Math.max(0, Math.min(99, min));
  const hi = Math.max(lo, Math.min(99, max));
  const span = hi - lo + 1;
  const x = (Math.imul(hash ^ salt, 2654435761) >>> 0) % span;
  return lo + x;
}

type Range = { min: number; max: number };

function biasFor(position: PositionCode | null | undefined): Record<FaceStatKey, Range> {
  const base: Record<FaceStatKey, Range> = {
    pac: { min: 55, max: 82 },
    sho: { min: 50, max: 78 },
    pas: { min: 55, max: 82 },
    dri: { min: 55, max: 82 },
    def: { min: 45, max: 75 },
    phy: { min: 55, max: 82 },
  };
  if (position === "ST") {
    base.sho = { min: 78, max: 94 };
    base.pac = { min: 70, max: 90 };
    base.def = { min: 28, max: 48 };
  } else if (position === "GK") {
    base.sho = { min: 18, max: 38 };
    base.pac = { min: 30, max: 52 };
    base.def = { min: 70, max: 90 };
    base.phy = { min: 68, max: 88 };
  } else if (position === "LW" || position === "RW") {
    base.pac = { min: 72, max: 92 };
    base.dri = { min: 70, max: 90 };
    base.def = { min: 30, max: 52 };
  } else if (position === "CB" || position === "LB" || position === "RB") {
    base.def = { min: 72, max: 92 };
    base.phy = { min: 70, max: 90 };
    base.sho = { min: 28, max: 52 };
  } else if (position === "CAM" || position === "CM") {
    base.pas = { min: 72, max: 92 };
    base.dri = { min: 68, max: 88 };
  }
  return base;
}

/** Mock DEV 6-pack — déterministe, jamais écrit en base. */
export function buildDevFaceStats(seed: string, position?: PositionCode | null): Record<FaceStatKey, number> {
  const hash = fnv1a(seed.trim() || "cpc");
  const bias = biasFor(position);
  const values = {} as Record<FaceStatKey, number>;
  FACE_STAT_KEYS.forEach((key, i) => {
    values[key] = pickInRange(hash, (i + 1) * 97, bias[key].min, bias[key].max);
  });
  return values;
}

export function resolveFaceStats(input: {
  verified: VerifiedStats | null | undefined;
  identityKind: EaIdentityKind | null | undefined;
  isDev: boolean;
  seed: string;
  position?: PositionCode | null;
}): FaceStatsPack | null {
  const real =
    input.identityKind === "USERNAME_EQUALITY" ? readStoredFaceStats(input.verified) : null;
  if (real) {
    return { source: "EA", values: real };
  }
  if (input.isDev) {
    return { source: "DEV", values: buildDevFaceStats(input.seed, input.position) };
  }
  return null;
}

export function visibleFaceStatCells(
  pack: FaceStatsPack | null | undefined
): { key: FaceStatKey; label: string; value: number }[] {
  if (!pack) return [];
  const out: { key: FaceStatKey; label: string; value: number }[] = [];
  for (const key of FACE_STAT_KEYS) {
    const value = pack.values[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    out.push({ key, label: FACE_STAT_LABELS[key], value });
  }
  return out;
}

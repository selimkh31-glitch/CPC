/**
 * Claim club EA — id + phase de confirmation.
 * Jamais un regionId Clubs.zone, jamais un first-hit auto-link.
 */

const EA_CLUB_ID_RE = /^\d{1,16}$/;

/** EA `clubId` numérique uniquement (string digits). Vide / texte / UUID → null. */
export function parseNumericEaClubId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    const s = String(Math.trunc(value));
    return EA_CLUB_ID_RE.test(s) ? s : null;
  }
  if (typeof value === "string") {
    const s = value.trim();
    return EA_CLUB_ID_RE.test(s) ? s : null;
  }
  return null;
}

export function isNumericEaClubId(value: unknown): boolean {
  return parseNumericEaClubId(value) !== null;
}

export type LinkEaClubPhase = "search" | "candidates" | "confirm";

/** Le write `link` n'est autorisé qu'après le tap Confirmer. */
export function canCallLinkEaClub(phase: LinkEaClubPhase): boolean {
  return phase === "confirm";
}

export function formatVisibleMembers(names: readonly string[], max = 3): string | null {
  const cleaned = names.map((n) => n.trim()).filter(Boolean).slice(0, max);
  if (cleaned.length === 0) return null;
  return `membres visibles: ${cleaned.join(", ")}`;
}

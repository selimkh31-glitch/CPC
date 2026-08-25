/**
 * Lecture club : 0 lignes / PGRST116 = club disparu, pas une panne réseau.
 * Matching / RLS inchangés — on n'invente pas un club.
 */

export function isGoneClubReadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string | number; message?: string; details?: string; hint?: string };
  if (e.code === "PGRST116") return true;
  const blob = `${e.code ?? ""} ${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`;
  return /PGRST116/i.test(blob) || /0 rows/i.test(blob) || /\(or no\) rows/i.test(blob);
}

/** data ou null si le club n'existe plus ; throw seulement une vraie erreur. */
export function clubReadOrNull<T>(input: { data: T | null; error: unknown }): T | null {
  if (input.error && isGoneClubReadError(input.error)) return null;
  if (input.error) throw input.error;
  return input.data ?? null;
}

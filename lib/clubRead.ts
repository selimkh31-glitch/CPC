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

export type ManagedClubScreen = "loading" | "error" | "empty" | "ready";

/**
 * 0 clubs / pas de data → empty + créer, avant ErrorState.
 * ErrorState seulement s'il reste une data club et une vraie panne.
 */
export function managedClubScreenState(input: {
  clubId: string | null;
  club: unknown;
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
}): ManagedClubScreen {
  if (!input.clubId) return "empty";
  if (input.isLoading && !input.club) return "loading";
  if (!input.club) return "empty";
  if (input.isError) return "error";
  return "ready";
}

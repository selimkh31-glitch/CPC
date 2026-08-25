/**
 * Mode Joueur / Manager — choix de vie, pas une permission.
 * Persistance = SecureStore (clé par user). Le serveur / RLS ne lit pas ça.
 */
export type AppMode = "PLAYER" | "CLUB";

export const MODE_DOOR_COPY = {
  title: "Tu joues ou tu gères ?",
  player: "JOUEUR",
  playerHint: "Je joue.",
  manager: "MANAGER",
  managerHint: "Je gère le club.",
  toManager: "Passer en manager",
  toPlayer: "Passer en joueur",
} as const;

export function parseStoredAppMode(raw: string | null | undefined): AppMode | null {
  if (raw === "PLAYER" || raw === "CLUB") return raw;
  return null;
}

export function appModeStorageKey(userId: string): string {
  return `cpc.appMode.${userId}`;
}

/** Porte seulement si le stockage est lu et qu'aucun mode n'est enregistré. */
export function shouldShowModeDoor(input: { hydrated: boolean; mode: AppMode | null }): boolean {
  return input.hydrated && input.mode === null;
}

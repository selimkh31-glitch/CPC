/**
 * LIVE recrutement (joueur + club) — logique pure, partagée UI / tests.
 *
 * Un LIVE CPC = "disponible pour recruter / être recruté MAINTENANT" dans
 * EA SPORTS FC 27 Pro Clubs, jamais une présence in-app (voir usePresence)
 * ni un coup d'envoi de match (voir match_checkins).
 *
 * Règle non négociable : un LIVE sans `expires_at` n'est PAS actif.
 * Pas de session éternelle, même si `is_live` est resté true (cron en retard).
 */

export const LIVE_DURATION_OPTIONS = [
  { value: String(30 * 60 * 1000), label: "30 min" },
  { value: String(60 * 60 * 1000), label: "1 h" },
  { value: String(2 * 60 * 60 * 1000), label: "2 h" },
] as const;

export const DEFAULT_LIVE_DURATION_MS = 2 * 60 * 60 * 1000;

export interface LiveSessionLike {
  is_live: boolean;
  expires_at: string | null;
}

export function parseLiveDurationMs(raw: string | undefined, fallback = DEFAULT_LIVE_DURATION_MS): number {
  const allowed = LIVE_DURATION_OPTIONS.map((o) => Number(o.value));
  const n = raw ? Number(raw) : fallback;
  if (!Number.isFinite(n) || !allowed.includes(n)) return fallback;
  return n;
}

export function computeLiveExpiresAt(nowMs: number, durationMs = DEFAULT_LIVE_DURATION_MS): Date {
  const duration = parseLiveDurationMs(String(durationMs), DEFAULT_LIVE_DURATION_MS);
  return new Date(nowMs + duration);
}

export function remainingLiveMs(expiresAt: string | null, nowMs: number): number {
  if (!expiresAt) return 0;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, t - nowMs);
}

/** Actif seulement si flag live ET expiry future. Jamais d'infini. */
export function isLiveActive(session: LiveSessionLike | null | undefined, nowMs: number): boolean {
  if (!session || !session.is_live) return false;
  return remainingLiveMs(session.expires_at, nowMs) > 0;
}

/** Première session réellement LIVE (flag + TTL), jamais un is_live orphelin. */
export function findActiveLiveSession<T extends LiveSessionLike>(
  sessions: T[] | null | undefined,
  nowMs: number
): T | null {
  return sessions?.find((s) => isLiveActive(s, nowMs)) ?? null;
}

export function formatLiveRemaining(expiresAt: string | null, nowMs: number): string {
  const ms = remainingLiveMs(expiresAt, nowMs);
  if (ms <= 0) return "C'est fini";
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes < 60) return `encore ${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `encore ${hours} h`;
  return `encore ${hours} h ${minutes} min`;
}

export type LiveUiState = "off" | "open" | "ready";

/** LIVE = un état, pas un feed. ready > open > off. */
export function liveUiState(input: { liveActive: boolean; matchActive?: boolean }): LiveUiState {
  if (input.matchActive) return "ready";
  if (input.liveActive) return "open";
  return "off";
}

/** Feuille club (formation / check-in) — pas `/match-sheet` (ClubHome lecture). */
export const CLUB_MATCH_SHEET_HREF = "/match";

/**
 * Club LIVE chrome. `ready` est un badge match, jamais un écran qui cache
 * Passer LIVE. Matching / TTL inchangés.
 */
export function clubLiveLayout(input: {
  canManage: boolean;
  liveActive: boolean;
  matchActive: boolean;
}): {
  showSessionPanel: true;
  matchSheetFilled: boolean;
  showRecruit: boolean;
  stopLabel: typeof LIVE_UX_COPY.quit | typeof LIVE_UX_COPY.stop;
} {
  return {
    showSessionPanel: true,
    matchSheetFilled: input.matchActive,
    showRecruit: input.canManage && input.liveActive,
    stopLabel: input.matchActive ? LIVE_UX_COPY.quit : LIVE_UX_COPY.stop,
  };
}

/**
 * Copy LIVE (tu, football, courte). Pas de TTL / session / matching à l'écran.
 * Empty = on cherche un match, jamais un vide muet ni une session fake.
 */
export const LIVE_UX_COPY = {
  title: "LIVE",
  playerHeadline: "On cherche un match",
  clubHeadline: "On cherche un match",
  goLive: "Passer LIVE",
  findClub: "Clubs en LIVE",
  backToLive: "LIVE",
  emptyNoClubs: "Personne ne cherche un match. Passe LIVE, ou vois les clubs.",
  emptySelfLive: "On cherche. Personne d'autre pour l'instant.",
  emptyNoPlayers: "Personne d'autre ne cherche pour l'instant.",
  liveClubsNow: (n: number) => (n === 1 ? "1 club en LIVE" : `${n} clubs en LIVE`),
  noLiveClubs: "Aucun club en LIVE",
  otherPlayers: "Ils veulent jouer",
  clubEmptyPlayersLive: "Personne de dispo sur tes postes.",
  clubEmptyPlayersOffline: "Passe LIVE pour voir qui veut jouer.",
  offTitle: "On cherche un match",
  openTitle: "On cherche un match",
  clubOpenTitle: "Club en LIVE",
  readyTitle: "Le match est lancé",
  stop: "Arrêter",
  quit: "Quitter",
  newLive: "Nouveau LIVE",
  edit: "Modifier",
  matchSheet: "Feuille de match",
  stillLooking: "Les clubs te voient.",
  clubStillLooking: "Les joueurs te voient.",
  howLong: "Combien de temps ?",
  noteOptional: "Une note (optionnel)",
  hideNote: "Masquer la note",
} as const;

export function liveFeedEmptyCopy(input: { selfLive: boolean; liveClubCount: number }): string {
  if (input.selfLive && input.liveClubCount === 0) return LIVE_UX_COPY.emptySelfLive;
  if (input.liveClubCount === 0) return LIVE_UX_COPY.emptyNoClubs;
  return LIVE_UX_COPY.emptyNoPlayers;
}

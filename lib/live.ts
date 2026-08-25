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
  if (ms <= 0) return "Expiré";
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/**
 * Copy LIVE (tu, courte). Pas de sessions inventées, pas de matching changé.
 * Empty LIVE = chercher un match / créer une session, jamais un vide muet.
 */
export const LIVE_UX_COPY = {
  title: "LIVE",
  playerHeadline: "Tu veux jouer maintenant ?",
  clubHeadline: "Tu recrutes maintenant ?",
  goLive: "Passer LIVE",
  findClub: "Chercher un club",
  backToLive: "LIVE",
  emptyNoClubs: "Aucun club LIVE. Passe LIVE pour qu'on te trouve, ou cherche un club.",
  emptySelfLive: "Tu es LIVE. Aucun club ne recrute pour l'instant.",
  emptyNoPlayers: "Aucun autre joueur LIVE pour l'instant.",
  liveClubsNow: (n: number) => `${n} club${n > 1 ? "s" : ""} LIVE maintenant`,
  noLiveClubs: "Aucun club LIVE pour l'instant",
  otherPlayers: "Autres joueurs LIVE",
  clubEmptyPlayersLive: "Aucun joueur LIVE compatible (poste + plateforme).",
  clubEmptyPlayersOffline: "Passe LIVE pour voir les joueurs dispo.",
} as const;

export function liveFeedEmptyCopy(input: { selfLive: boolean; liveClubCount: number }): string {
  if (input.selfLive && input.liveClubCount === 0) return LIVE_UX_COPY.emptySelfLive;
  if (input.liveClubCount === 0) return LIVE_UX_COPY.emptyNoClubs;
  return LIVE_UX_COPY.emptyNoPlayers;
}

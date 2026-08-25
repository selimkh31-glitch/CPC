/**
 * Historique de matchs réel (ClubPro Card / profil joueur / profil club).
 *
 * Join joueur (utilisé) :
 *   match_participations.user_id = joueur
 *   AND status = 'PRESENT'
 *   AND match_results.match_checkin_id = match_participations.match_checkin_id
 *
 * `match_participations` est le snapshot des `slot_assignments` AU lancement
 * du check-in (`launch-match-checkin`). Les `slot_assignments` actuels ne
 * sont pas historiques. `mvp_user_id` n'est pas le filtre joueur (un seul
 * titulaire MVP par match).
 *
 * Une ligne ne compte que si `match_results` existe — c'est-à-dire un
 * `finalize_match` persisté. Check-in sans résultat, ABSENT, et scores
 * inventés (faux 0-0) sont exclus.
 *
 * Join club (profil club) : `match_results.club_id`.
 *
 * Jamais `season_stats`. Jamais de classement inventé. OVR CPC = `computeOvr`.
 */
import type { MatchOutcome } from "@/lib/types";
import { tournamentClubDisplayName } from "@/lib/tournaments";

export const MATCH_HISTORY_LIMIT = 5;

/**
 * Fenêtre PRESENT récente côté `match_participations` (pas de `created_at`
 * sur cette table — ordre via `match_checkins.launched_at`). Plus large que
 * MATCH_HISTORY_LIMIT pour ne pas masquer 5 résultats finalisés derrière des
 * check-ins encore ouverts.
 */
export const PLAYER_MATCH_HISTORY_LOOKBACK = 40;

export const MATCH_HISTORY_COPY = {
  title: "Derniers matchs",
  empty: "Pas encore de match enregistré",
  loadError: "Impossible de charger l'historique des matchs.",
} as const;

/** Join documenté — profil joueur / ClubPro Card. */
export const PLAYER_MATCH_HISTORY_JOIN =
  "match_participations.user_id (PRESENT) → match_checkin_id → match_results (finalize_match)";

/** Join documenté — profil club. */
export const CLUB_MATCH_HISTORY_JOIN = "match_results.club_id";

const MONTHS_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
] as const;

export interface MatchHistoryParticipationInput {
  match_checkin_id: string;
  status: string;
}

export interface MatchHistoryResultInput {
  id: string;
  match_checkin_id: string;
  club_id: string;
  our_score: unknown;
  opponent_score: unknown;
  outcome: unknown;
  created_at: string;
  opponent_club_id?: string | null;
}

export interface MatchHistoryItem {
  id: string;
  createdAt: string;
  dateLabel: string | null;
  /** Nom réel hydraté — `null` si manquant / placeholder, jamais inventé. */
  clubName: string | null;
  clubId: string;
  /** Club adverse si `opponent_club_id` + nom déjà hydratés. Jamais inventé. */
  opponentClubId: string | null;
  opponentClubName: string | null;
  /** `null` si our_score / opponent_score absents — jamais un faux 0-0. */
  scoreLine: string | null;
  outcome: MatchOutcome;
}

export function isPersistedMatchOutcome(value: unknown): value is MatchOutcome {
  return value === "WIN" || value === "DRAW" || value === "LOSS";
}

export function formatMatchHistoryDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Score affiché seulement si les deux entiers sont réellement présents.
 * Un 0-0 n'apparaît que si les deux scores persistés valent 0.
 */
export function formatMatchScore(ourScore: unknown, opponentScore: unknown): string | null {
  if (typeof ourScore !== "number" || typeof opponentScore !== "number") return null;
  if (!Number.isFinite(ourScore) || !Number.isFinite(opponentScore)) return null;
  return `${ourScore} — ${opponentScore}`;
}

function nameFromMap(
  clubId: string,
  names: Map<string, string> | Record<string, string> | undefined
): string | null {
  if (!names) return null;
  const raw = names instanceof Map ? names.get(clubId) : names[clubId];
  return tournamentClubDisplayName(raw);
}

function toHistoryItem(
  row: MatchHistoryResultInput,
  clubName: string | null,
  names?: Map<string, string> | Record<string, string>
): MatchHistoryItem | null {
  if (!row.id || !isPersistedMatchOutcome(row.outcome) || !row.created_at) return null;
  const opponentId =
    typeof row.opponent_club_id === "string" && row.opponent_club_id.trim() && row.opponent_club_id !== row.club_id
      ? row.opponent_club_id.trim()
      : null;
  const opponentRaw = opponentId && names ? (names instanceof Map ? names.get(opponentId) : names[opponentId]) : undefined;
  return {
    id: row.id,
    createdAt: row.created_at,
    dateLabel: formatMatchHistoryDate(row.created_at),
    clubName: tournamentClubDisplayName(clubName),
    clubId: row.club_id,
    opponentClubId: opponentId,
    opponentClubName: opponentId ? tournamentClubDisplayName(opponentRaw) : null,
    scoreLine: formatMatchScore(row.our_score, row.opponent_score),
    outcome: row.outcome,
  };
}

function sortAndLimit(items: MatchHistoryItem[], limit: number): MatchHistoryItem[] {
  return [...items]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/**
 * Join joueur : PRESENT au check-in + ligne `match_results` (finalize_match).
 * N'utilise ni `mvp_user_id`, ni `slot_assignments` courants, ni `season_stats`.
 */
export function buildPlayerMatchHistory(input: {
  participations: readonly MatchHistoryParticipationInput[];
  results: readonly MatchHistoryResultInput[];
  clubNames?: Map<string, string> | Record<string, string>;
  limit?: number;
}): MatchHistoryItem[] {
  const presentCheckins = new Set(
    input.participations
      .filter((row) => row.status === "PRESENT" && row.match_checkin_id)
      .map((row) => row.match_checkin_id)
  );
  if (presentCheckins.size === 0) return [];

  const items: MatchHistoryItem[] = [];
  for (const row of input.results) {
    if (!presentCheckins.has(row.match_checkin_id)) continue;
    const item = toHistoryItem(row, nameFromMap(row.club_id, input.clubNames), input.clubNames);
    if (item) items.push(item);
  }
  return sortAndLimit(items, input.limit ?? MATCH_HISTORY_LIMIT);
}

/**
 * Nombre de matchs CPC du joueur (même join que l'historique).
 * Pas de W-D-L ici : `match_results` est le club enregistreur seulement —
 * afficher V-N-D serait une attribution trop mince. Compter, c'est honnête.
 */
export function countPlayerCpcMatches(input: {
  participations: readonly MatchHistoryParticipationInput[];
  results: readonly MatchHistoryResultInput[];
}): number {
  return buildPlayerMatchHistory({
    participations: input.participations,
    results: input.results,
    limit: Number.MAX_SAFE_INTEGER,
  }).length;
}

/**
 * Join club : `match_results.club_id` — résultats persistés uniquement.
 */
export function buildClubMatchHistory(input: {
  results: readonly MatchHistoryResultInput[];
  clubId: string;
  clubName?: string | null;
  clubNames?: Map<string, string> | Record<string, string>;
  limit?: number;
}): MatchHistoryItem[] {
  const items: MatchHistoryItem[] = [];
  for (const row of input.results) {
    if (row.club_id !== input.clubId) continue;
    const ownName = nameFromMap(row.club_id, input.clubNames) ?? tournamentClubDisplayName(input.clubName);
    const item = toHistoryItem(row, ownName, input.clubNames);
    if (item) items.push(item);
  }
  return sortAndLimit(items, input.limit ?? MATCH_HISTORY_LIMIT);
}

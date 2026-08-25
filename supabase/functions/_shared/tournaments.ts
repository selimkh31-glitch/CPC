/**
 * Tournois V1 — EA SPORTS FC 27 Pro Clubs.
 *
 * SOURCE DE VÉRITÉ UNIQUE : un tournoi EST une compétition (kind=TOURNAMENT),
 * pas une 2e table. Inscriptions = competition_clubs. Scores / vainqueurs =
 * match_results liés (competition_id + opponent_club_id). Le tableau ne
 * rend QUE des lignes tournament_matches persistées. Jamais season_stats.
 *
 * Fichier feuille (pas d'import _shared) pour rester dual Deno Edge / tsc app,
 * comme competitions.ts / finalizeMatch.ts.
 * Edge : import `../_shared/tournaments.ts`. App : `lib/tournaments.ts`.
 */

export const COMPETITION_KINDS = ["COMPETITION", "TOURNAMENT"] as const;
export type CompetitionKind = (typeof COMPETITION_KINDS)[number];

export const TOURNAMENT_KIND: CompetitionKind = "TOURNAMENT";
export const STANDARD_COMPETITION_KIND: CompetitionKind = "COMPETITION";

export const TOURNAMENT_CREATE_STATUSES = ["DRAFT", "OPEN"] as const;
export type TournamentCreateStatus = (typeof TOURNAMENT_CREATE_STATUSES)[number];

export const TOURNAMENT_MATCH_STATUSES = ["SCHEDULED", "PLAYED"] as const;
export type TournamentMatchStatus = (typeof TOURNAMENT_MATCH_STATUSES)[number];

export const FIRST_TOURNAMENT_ROUND = 1;
export const MIN_CLUBS_TO_SCHEDULE = 2;

export const TOURNAMENT_NAME_MIN = 1;
export const TOURNAMENT_NAME_MAX = 80;

export const TOURNAMENT_COPY = {
  title: "Tournois",
  subtitle: "Tournois virtuels EA SPORTS FC 27 Pro Clubs. Tableau = matchs enregistrés, pas un décor.",
  create: "Créer un tournoi",
  createCta: "Publier le tournoi",
  nameLabel: "Nom du tournoi",
  namePlaceholder: "Coupe du jeudi — Pro Clubs",
  statusLabel: "Statut",
  registerCta: "Inscrire mon club",
  alreadyRegistered: "Club déjà inscrit",
  noManagedClub: "Tu dois être owner ou manager d'un club Pro Clubs pour inscrire un club.",
  empty: "Aucun tournoi Pro Clubs ouvert pour le moment.",
  emptyHint: "Crée-en un (brouillon ou ouvert) — virtuel, FC 27 uniquement.",
  loadError: "Impossible de charger les tournois.",
  detailLoadError: "Impossible de charger ce tournoi.",
  registerConflict: "Ce club Pro Clubs est déjà inscrit à ce tournoi.",
  notOpen: "Les inscriptions ne sont ouvertes que pour un tournoi OPEN.",
  notManager: "Tu n'es pas owner ou manager de ce club Pro Clubs.",
  tournamentNotFound: "Tournoi introuvable.",
  created: "Tournoi Pro Clubs créé.",
  registered: "Club inscrit au tournoi.",
  draftCannotRegister: "Les clubs ne peuvent pas s'inscrire : ce tournoi est encore en brouillon.",
  closedCannotRegister: "Les inscriptions sont fermées.",
  createOwnerHint: "Tu en seras le créateur. Un brouillon reste invisible aux autres, et aucun club ne peut s'y inscrire.",
  draftCreateHint: "Visible seulement par toi. Les clubs ne peuvent pas s'inscrire tant qu'il n'est pas ouvert.",
  openCreateHint: "Les clubs Pro Clubs gérés (owner ou manager) peuvent s'inscrire.",
  creatorLabel: "Créateur",
  participantsTitle: "Clubs inscrits",
  participantsEmpty: "Aucun club Pro Clubs inscrit.",
  openJoinHint: "Ouvert — les clubs Pro Clubs gérés (owner ou manager) peuvent s'inscrire.",
  bracketTitle: "Tableau",
  bracketEmpty: "Aucun match programmé. Le tableau n'affiche que des paires enregistrées en base.",
  bracketEmptyHint: "Le créateur peut générer le premier tour une fois au moins deux clubs inscrits.",
  needTwoClubs: "Il faut au moins deux clubs inscrits pour générer un tour.",
  cannotScheduleHint: "Pas assez de clubs inscrits — aucun match n'est inventé.",
  scheduleCta: "Générer le premier tour",
  scheduleNextCta: "Générer le tour suivant",
  scheduleLocked: "Ce tour est déjà généré.",
  scheduled: "Tour enregistré.",
  scheduledNext: "Tour suivant enregistré.",
  scheduleNotOwner: "Seul le créateur du tournoi peut générer un tour.",
  scheduleNotOpen: "Ouvre le tournoi (OPEN) et inscris au moins deux clubs avant de générer un tour.",
  scheduleWaitResults:
    "Tous les matchs du tour doivent avoir un vainqueur (résultat lié, pas de nul, pas « pas encore joué ») avant le tour suivant.",
  scheduleDrawBlocks: "Un match nul n'a pas de vainqueur — le tour suivant n'est pas généré.",
  alreadyComplete: "Ce tournoi a déjà un vainqueur.",
  needTwoAdvancing: "Pas assez de clubs qualifiés (vainqueurs PLAYED) pour un tour suivant.",
  notATournament: "Cette compétition n'est pas un tournoi.",
  roundLabel: "Tour",
  notPlayed: "pas encore joué",
  drawNoWinner: "Match nul — pas de vainqueur.",
  winnerLabel: "Vainqueur",
  championTitle: "Vainqueur du tournoi",
  championEmpty: "Pas de vainqueur tant que la finale n'a pas de résultat lié.",
  championHint: "Le vainqueur vient uniquement d'un match PLAYED. Jamais un 0-0 inventé.",
  progressionTitle: "Qualifiés",
  progressionEmpty: "Aucun club qualifié : aucun match du tableau n'a encore de résultat lié.",
  progressionHint: "La progression ne compte que les matchs PLAYED (résultat Pro Clubs lié). Jamais un 0-0 inventé.",
  unpairedTitle: "Sans adversaire (nombre impair)",
  unpairedHint: "Ce club est dans ce tour mais n'a pas de match — pas d'adversaire inventé.",
  registeredAfterSchedule: "Inscrit, hors tableau du premier tour.",
  matchesLoadError: "Impossible de charger les matchs du tournoi.",
  linkedResultCta: "Voir le tournoi",
  kindLabel: "Tournoi",
} as const;

export const TOURNAMENT_STATUS_LABELS: Record<"DRAFT" | "OPEN" | "CLOSED", string> = {
  DRAFT: "Brouillon",
  OPEN: "Ouvert",
  CLOSED: "Fermé",
};

export const TOURNAMENT_MATCH_STATUS_LABELS: Record<TournamentMatchStatus, string> = {
  SCHEDULED: "Programmé",
  PLAYED: "Joué",
};

/** Deep link détail — stack `/tournaments/[id]`, pas un onglet. */
export function tournamentDetailHref(tournamentId: string | null | undefined): string {
  if (typeof tournamentId === "string" && tournamentId.length > 0) {
    return `/tournaments/${tournamentId}`;
  }
  return "/tournaments";
}

export function isCompetitionKind(value: unknown): value is CompetitionKind {
  return typeof value === "string" && (COMPETITION_KINDS as readonly string[]).includes(value);
}

export function isTournamentKind(value: unknown): boolean {
  return value === TOURNAMENT_KIND;
}

export function isTournamentCreateStatus(value: unknown): value is TournamentCreateStatus {
  return typeof value === "string" && (TOURNAMENT_CREATE_STATUSES as readonly string[]).includes(value);
}

export function isTournamentMatchStatus(value: unknown): value is TournamentMatchStatus {
  return typeof value === "string" && (TOURNAMENT_MATCH_STATUSES as readonly string[]).includes(value);
}

export function normalizeTournamentName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < TOURNAMENT_NAME_MIN || trimmed.length > TOURNAMENT_NAME_MAX) return null;
  return trimmed;
}

/** Création tournoi (Edge service_role) : JWT = created_by, DRAFT|OPEN, kind TOURNAMENT. */
export function canInsertTournament(input: {
  actorId: string;
  createdBy: string;
  status: string;
  kind?: string | null;
}): boolean {
  const kind = input.kind ?? TOURNAMENT_KIND;
  return input.actorId === input.createdBy && isTournamentCreateStatus(input.status) && kind === TOURNAMENT_KIND;
}

export type ScheduleBlockReason =
  | "not_owner"
  | "not_open"
  | "not_a_tournament"
  | "need_two_clubs"
  | "already_scheduled"
  | "round_incomplete"
  | "draw_blocks"
  | "already_complete"
  | "need_two_advancing";

export function canScheduleFirstRound(input: {
  actorId: string;
  createdBy: string;
  status: string;
  kind: string;
  registeredClubCount: number;
  existingMatchCount: number;
}): { ok: true } | { ok: false; reason: ScheduleBlockReason } {
  if (input.kind !== TOURNAMENT_KIND) return { ok: false, reason: "not_a_tournament" };
  if (input.actorId !== input.createdBy) return { ok: false, reason: "not_owner" };
  if (input.status !== "OPEN") return { ok: false, reason: "not_open" };
  if (input.existingMatchCount > 0) return { ok: false, reason: "already_scheduled" };
  if (input.registeredClubCount < MIN_CLUBS_TO_SCHEDULE) return { ok: false, reason: "need_two_clubs" };
  return { ok: true };
}

export function scheduleBlockHttpStatus(reason: ScheduleBlockReason): 400 | 403 | 409 {
  if (reason === "already_scheduled") return 409;
  if (reason === "not_owner") return 403;
  return 400;
}

export function scheduleBlockMessage(reason: ScheduleBlockReason): string {
  if (reason === "already_scheduled") return TOURNAMENT_COPY.scheduleLocked;
  if (reason === "not_owner") return TOURNAMENT_COPY.scheduleNotOwner;
  if (reason === "need_two_clubs") return TOURNAMENT_COPY.needTwoClubs;
  if (reason === "not_a_tournament") return TOURNAMENT_COPY.notATournament;
  if (reason === "round_incomplete") return TOURNAMENT_COPY.scheduleWaitResults;
  if (reason === "draw_blocks") return TOURNAMENT_COPY.scheduleDrawBlocks;
  if (reason === "already_complete") return TOURNAMENT_COPY.alreadyComplete;
  if (reason === "need_two_advancing") return TOURNAMENT_COPY.needTwoAdvancing;
  return TOURNAMENT_COPY.scheduleNotOpen;
}

export interface ScheduledPairing {
  round: number;
  slot: number;
  clubAId: string;
  clubBId: string;
  status: "SCHEDULED";
}

export interface RoundSchedule {
  pairings: ScheduledPairing[];
  unpairedClubIds: string[];
  round: number;
}

/**
 * Tour déterministe : tri des ids, paires consécutives.
 * Club impair restant = unpaired (pas de bye inventé, pas de match fantôme).
 * < 2 clubs → pairings vides (l'Edge refuse avant d'écrire).
 */
export function scheduleRoundFromClubIds(clubIds: readonly string[], round: number): RoundSchedule {
  const unique = [...new Set(clubIds.filter((id) => typeof id === "string" && id.length > 0))];
  unique.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const pairings: ScheduledPairing[] = [];
  let slot = 0;
  for (let i = 0; i + 1 < unique.length; i += 2) {
    const a = unique[i];
    const b = unique[i + 1];
    const clubAId = a < b ? a : b;
    const clubBId = a < b ? b : a;
    pairings.push({
      round,
      slot,
      clubAId,
      clubBId,
      status: "SCHEDULED",
    });
    slot += 1;
  }
  const unpairedClubIds = unique.length % 2 === 1 ? [unique[unique.length - 1]] : [];
  return { pairings, unpairedClubIds, round };
}

export function scheduleFirstRoundFromClubs(clubIds: readonly string[]): RoundSchedule {
  return scheduleRoundFromClubIds(clubIds, FIRST_TOURNAMENT_ROUND);
}

export interface TournamentMatchInput {
  id: string;
  competition_id: string;
  round: number;
  slot: number;
  club_a_id: string;
  club_b_id: string;
  status: string;
}

export interface TournamentLinkedResultInput {
  club_id: string;
  opponent_club_id: string | null;
  competition_id: string | null;
  outcome: string;
  our_score: number;
  opponent_score: number;
}

function isLinkedPairResult(
  row: TournamentLinkedResultInput,
  competitionId: string,
  clubAId: string,
  clubBId: string
): boolean {
  if (row.competition_id !== competitionId) return false;
  if (typeof row.opponent_club_id !== "string" || row.opponent_club_id.length === 0) return false;
  if (row.opponent_club_id === row.club_id) return false;
  if (row.outcome !== "WIN" && row.outcome !== "DRAW" && row.outcome !== "LOSS") return false;
  return (
    (row.club_id === clubAId && row.opponent_club_id === clubBId) ||
    (row.club_id === clubBId && row.opponent_club_id === clubAId)
  );
}

export function linkedResultForPair(
  rows: readonly TournamentLinkedResultInput[],
  competitionId: string,
  clubAId: string,
  clubBId: string
): TournamentLinkedResultInput | null {
  for (const row of rows) {
    if (isLinkedPairResult(row, competitionId, clubAId, clubBId)) return row;
  }
  return null;
}

/**
 * Nom affichable : uniquement un nom réel hydraté.
 * Refuse les placeholders « Club Pro Clubs » / « Club » (même doctrine que
 * `clubRankingRowHref`). Vide / absent → null (omettre le label).
 */
export function tournamentClubDisplayName(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed === "Club Pro Clubs" || trimmed === "Club") return null;
  return trimmed;
}

export function collectTournamentClubNames(
  clubs: readonly { club_id: string; club?: { name?: string | null } | null }[],
  matches: readonly {
    club_a_id: string;
    club_b_id: string;
    club_a?: { name?: string | null } | null;
    club_b?: { name?: string | null } | null;
  }[] = []
): Map<string, string> {
  const names = new Map<string, string>();
  const set = (id: string, name: string | null | undefined) => {
    const display = tournamentClubDisplayName(name);
    if (display) names.set(id, display);
  };
  for (const row of clubs) set(row.club_id, row.club?.name);
  for (const match of matches) {
    set(match.club_a_id, match.club_a?.name);
    set(match.club_b_id, match.club_b?.name);
  }
  return names;
}

/**
 * Club enregistreur du `match_results` lié à la paire.
 * Null si pas encore joué — pas de bouton mort, pas de score inventé.
 */
export function tournamentBracketRecordingClubId(
  match: Pick<TournamentMatchInput, "club_a_id" | "club_b_id" | "competition_id">,
  results: readonly TournamentLinkedResultInput[]
): string | null {
  return linkedResultForPair(results, match.competition_id, match.club_a_id, match.club_b_id)?.club_id ?? null;
}

/** Joué = un match_results lié existe. Le statut PLAYED seul ne suffit pas (pas de score inventé). */
export function tournamentMatchIsPlayed(
  match: Pick<TournamentMatchInput, "club_a_id" | "club_b_id" | "competition_id">,
  results: readonly TournamentLinkedResultInput[]
): boolean {
  return linkedResultForPair(results, match.competition_id, match.club_a_id, match.club_b_id) != null;
}

/**
 * Score affiché : uniquement depuis match_results lié.
 * Pas de résultat → « pas encore joué » (jamais 0-0).
 * Un 0-0 réel (DRAW joué) s'affiche seulement s'il existe en base.
 */
export function tournamentMatchScoreLabel(
  match: Pick<TournamentMatchInput, "club_a_id" | "club_b_id" | "competition_id">,
  results: readonly TournamentLinkedResultInput[]
): string {
  const row = linkedResultForPair(results, match.competition_id, match.club_a_id, match.club_b_id);
  if (!row) return TOURNAMENT_COPY.notPlayed;
  const aIsRecorder = row.club_id === match.club_a_id;
  const scoreA = aIsRecorder ? row.our_score : row.opponent_score;
  const scoreB = aIsRecorder ? row.opponent_score : row.our_score;
  return `${scoreA} — ${scoreB}`;
}

export function tournamentMatchWinnerId(
  match: Pick<TournamentMatchInput, "club_a_id" | "club_b_id" | "competition_id">,
  results: readonly TournamentLinkedResultInput[]
): string | null {
  const row = linkedResultForPair(results, match.competition_id, match.club_a_id, match.club_b_id);
  if (!row) return null;
  if (row.outcome === "DRAW") return null;
  if (row.outcome === "WIN") return row.club_id;
  return row.opponent_club_id;
}

/** Qualifiés = vainqueurs de paires avec résultat lié. Nuls exclus. */
export function tournamentQualifiedClubIds(
  matches: readonly TournamentMatchInput[],
  results: readonly TournamentLinkedResultInput[]
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const sorted = [...matches].sort((a, b) => a.round - b.round || a.slot - b.slot);
  for (const match of sorted) {
    const winnerId = tournamentMatchWinnerId(match, results);
    if (!winnerId || seen.has(winnerId)) continue;
    seen.add(winnerId);
    ids.push(winnerId);
  }
  return ids;
}

export function unpairedRegisteredClubIds(
  registeredClubIds: readonly string[],
  matches: readonly Pick<TournamentMatchInput, "club_a_id" | "club_b_id">[]
): string[] {
  const inBracket = new Set<string>();
  for (const match of matches) {
    inBracket.add(match.club_a_id);
    inBracket.add(match.club_b_id);
  }
  return registeredClubIds.filter((id) => !inBracket.has(id));
}

export interface TournamentRoundClubInput {
  competition_id: string;
  round: number;
  club_id: string;
}

export function latestRoundNumber(matches: readonly Pick<TournamentMatchInput, "round">[]): number | null {
  if (matches.length === 0) return null;
  let max = matches[0].round;
  for (const match of matches) {
    if (match.round > max) max = match.round;
  }
  return max;
}

export function matchesInRound<T extends Pick<TournamentMatchInput, "round" | "slot">>(
  matches: readonly T[],
  round: number
): T[] {
  return matches.filter((match) => match.round === round).sort((a, b) => a.slot - b.slot);
}

export function clubIdsInRound(
  roundClubs: readonly TournamentRoundClubInput[],
  round: number
): string[] {
  return roundClubs.filter((row) => row.round === round).map((row) => row.club_id);
}

export function unpairedClubIdsInRound(
  roundClubIds: readonly string[],
  roundMatches: readonly Pick<TournamentMatchInput, "club_a_id" | "club_b_id">[]
): string[] {
  return unpairedRegisteredClubIds(roundClubIds, roundMatches);
}

export type NextRoundPool =
  | { ok: true; clubIds: string[] }
  | { ok: false; reason: "round_incomplete" | "draw_blocks" };

/**
 * Clubs du tour suivant : vainqueurs PLAYED du tour + clubs du pool sans match.
 * Unplayed / nul → pas de tour suivant (pas de bye inventé, pas de vainqueur inventé).
 */
export function nextRoundClubIds(
  roundMatches: readonly TournamentMatchInput[],
  roundClubIds: readonly string[],
  results: readonly TournamentLinkedResultInput[]
): NextRoundPool {
  const winners: string[] = [];
  for (const match of [...roundMatches].sort((a, b) => a.slot - b.slot)) {
    if (!tournamentMatchIsPlayed(match, results)) return { ok: false, reason: "round_incomplete" };
    const winnerId = tournamentMatchWinnerId(match, results);
    if (!winnerId) return { ok: false, reason: "draw_blocks" };
    if (!winners.includes(winnerId)) winners.push(winnerId);
  }
  const unpaired = unpairedClubIdsInRound(roundClubIds, roundMatches);
  const clubIds = [...winners];
  for (const id of unpaired) {
    if (!clubIds.includes(id)) clubIds.push(id);
  }
  return { ok: true, clubIds };
}

/**
 * Vainqueur du tournoi = vainqueur PLAYED de la finale persistée :
 * dernier tour = exactement 1 match, pool du tour = 2 clubs.
 * Pas de finale inventée, pas de couronne si un club du pool n'a pas joué.
 */
export function tournamentChampionClubId(
  matches: readonly TournamentMatchInput[],
  results: readonly TournamentLinkedResultInput[],
  roundClubs: readonly TournamentRoundClubInput[] = []
): string | null {
  const latest = latestRoundNumber(matches);
  if (latest == null) return null;
  const latestMatches = matchesInRound(matches, latest);
  if (latestMatches.length !== 1) return null;
  const pool = clubIdsInRound(roundClubs, latest);
  if (pool.length > 0 && pool.length !== 2) return null;
  if (pool.length === 0) {
    const fromMatches = new Set<string>();
    fromMatches.add(latestMatches[0].club_a_id);
    fromMatches.add(latestMatches[0].club_b_id);
    if (fromMatches.size !== 2) return null;
  }
  return tournamentMatchWinnerId(latestMatches[0], results);
}

export type ScheduleRoundPlan =
  | { ok: true; intent: "first" | "next"; round: number; clubIds: string[] }
  | { ok: false; reason: ScheduleBlockReason };

export function canScheduleRound(input: {
  actorId: string;
  createdBy: string;
  status: string;
  kind: string;
  registeredClubIds: readonly string[];
  matches: readonly TournamentMatchInput[];
  results: readonly TournamentLinkedResultInput[];
  roundClubs: readonly TournamentRoundClubInput[];
}): ScheduleRoundPlan {
  if (input.kind !== TOURNAMENT_KIND) return { ok: false, reason: "not_a_tournament" };
  if (input.actorId !== input.createdBy) return { ok: false, reason: "not_owner" };
  if (input.status !== "OPEN") return { ok: false, reason: "not_open" };

  if (input.matches.length === 0) {
    if (input.registeredClubIds.length < MIN_CLUBS_TO_SCHEDULE) return { ok: false, reason: "need_two_clubs" };
    return { ok: true, intent: "first", round: FIRST_TOURNAMENT_ROUND, clubIds: [...input.registeredClubIds] };
  }

  if (tournamentChampionClubId(input.matches, input.results, input.roundClubs)) {
    return { ok: false, reason: "already_complete" };
  }

  const latest = latestRoundNumber(input.matches);
  if (latest == null) return { ok: false, reason: "need_two_clubs" };
  const latestMatches = matchesInRound(input.matches, latest);
  let pool = clubIdsInRound(input.roundClubs, latest);
  if (pool.length === 0) {
    const fromMatches = new Set<string>();
    for (const match of latestMatches) {
      fromMatches.add(match.club_a_id);
      fromMatches.add(match.club_b_id);
    }
    pool = [...fromMatches];
  }

  const nextPool = nextRoundClubIds(latestMatches, pool, input.results);
  if (!nextPool.ok) return { ok: false, reason: nextPool.reason };
  if (nextPool.clubIds.length < MIN_CLUBS_TO_SCHEDULE) return { ok: false, reason: "need_two_advancing" };
  if (input.matches.some((match) => match.round === latest + 1)) {
    return { ok: false, reason: "already_scheduled" };
  }
  return { ok: true, intent: "next", round: latest + 1, clubIds: nextPool.clubIds };
}

export function scheduleCtaLabel(intent: "first" | "next"): string {
  return intent === "next" ? TOURNAMENT_COPY.scheduleNextCta : TOURNAMENT_COPY.scheduleCta;
}

export function canShowTournamentBracket(matches: readonly unknown[]): boolean {
  return matches.length > 0;
}

const REQUIRED_SQL_FRAGMENTS = [
  "add column if not exists kind text not null default 'competition'",
  "check (kind in ('competition', 'tournament'))",
  "create table if not exists public.tournament_matches",
  "check (status in ('scheduled', 'played'))",
  "constraint tournament_matches_clubs_distinct",
  "grant all privileges on public.tournament_matches to service_role",
  "tournament_matches_select_open_or_own",
  "and kind = 'competition'",
  "tournament_match_insert_scheduled_only",
  "tournament_matches_mark_played",
  "create table if not exists public.tournament_round_clubs",
] as const;

const FORBIDDEN_SQL_FRAGMENTS = [
  "create table if not exists public.tournaments (",
  "create table if not exists public.standings",
  "create table if not exists public.tournament_standings",
  "season_stats",
  "our_score",
  "opponent_score",
] as const;

/** Vérifie le SQL 0029 (texte) : kind + paires, pas de 2e table tournoi / scores. */
export function tournamentV1SqlIssues(sql: string): string[] {
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");
  const issues: string[] = [];
  for (const fragment of REQUIRED_SQL_FRAGMENTS) {
    if (!normalized.includes(fragment.toLowerCase())) {
      issues.push(`manque: ${fragment}`);
    }
  }
  for (const fragment of FORBIDDEN_SQL_FRAGMENTS) {
    if (normalized.includes(fragment.toLowerCase())) {
      issues.push(`interdit: ${fragment}`);
    }
  }
  return issues;
}

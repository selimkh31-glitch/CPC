/**
 * Compétitions virtuelles EA SPORTS FC 27 Pro Clubs — fondation.
 *
 * SOURCE DE VÉRITÉ UNIQUE pour le statut, la validation du nom, les
 * prédicats RLS (lecture / création / inscription) et l'idempotence 409.
 * Edge Functions : import `../_shared/competitions.ts`. App mobile :
 * `lib/competitions.ts` (réexport). Classement uniquement depuis des
 * `match_results` réellement liés (competition_id + opponent_club_id).
 */

export const COMPETITION_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const COMPETITION_CREATE_STATUSES = ["DRAFT", "OPEN"] as const;
export type CompetitionCreateStatus = (typeof COMPETITION_CREATE_STATUSES)[number];

export const COMPETITION_NAME_MIN = 1;
export const COMPETITION_NAME_MAX = 80;

/** Code Postgres unique_violation — unique (competition_id, club_id). */
export const POSTGRES_UNIQUE_VIOLATION = "23505";
export const REGISTER_CONFLICT_STATUS = 409;

export const COMPETITION_COPY = {
  title: "Compétitions",
  subtitle: "Compétitions virtuelles EA SPORTS FC 27 Pro Clubs. Pas de football IRL.",
  create: "Créer une compétition",
  createCta: "Publier la compétition",
  nameLabel: "Nom de la compétition",
  namePlaceholder: "Coupe du jeudi — Pro Clubs",
  statusLabel: "Statut",
  registerCta: "Inscrire mon club",
  alreadyRegistered: "Club déjà inscrit",
  noManagedClub: "Tu dois être owner ou manager d'un club Pro Clubs pour inscrire un club.",
  empty: "Aucune compétition Pro Clubs ouverte pour le moment.",
  emptyHint: "Crée-en une (brouillon ou ouverte) — virtuelle, FC 27 uniquement.",
  loadError: "Impossible de charger les compétitions.",
  registerConflict: "Ce club Pro Clubs est déjà inscrit à cette compétition.",
  notOpen: "Les inscriptions ne sont ouvertes que pour une compétition OPEN.",
  notManager: "Tu n'es pas owner ou manager de ce club Pro Clubs.",
  competitionNotFound: "Compétition introuvable.",
  created: "Compétition Pro Clubs créée.",
  registered: "Club inscrit à la compétition.",
  standingsTitle: "Classement",
  standingsEmpty: "Pas de classement tant qu'aucun match lié n'a été enregistré pour cette compétition.",
  standingsEmptyHint:
    "Le classement se calcule uniquement depuis des résultats Pro Clubs avec un club adverse CPC et cette compétition. Aucun point inventé.",
  standingsLoadError: "Impossible de charger les résultats liés.",
  opponentLabel: "Club adverse",
  opponentSearchPlaceholder: "Rechercher un club Pro Clubs",
  opponentHint: "Tape au moins 2 lettres. Clubs CPC existants uniquement — pas un nom libre.",
  opponentRequired: "Choisis le club adverse parmi les clubs CPC existants.",
  opponentEmpty: "Aucun club Pro Clubs ne correspond.",
  opponentLoadError: "Impossible de charger les clubs.",
  competitionOptionalLabel: "Compétition (optionnel)",
  competitionNone: "Aucune — résultat amical (pas de classement)",
  competitionEmpty:
    "Ce club n'est inscrit à aucune compétition ouverte. Le résultat sera enregistré sans compétition.",
  competitionEmptyShared:
    "Les deux clubs ne sont inscrits ensemble à aucune compétition ouverte. Le résultat sera enregistré sans compétition.",
  competitionLoadError: "Impossible de charger les compétitions du club.",
} as const;

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  DRAFT: "Brouillon",
  OPEN: "Ouverte",
  CLOSED: "Fermée",
};

/** Colonnes match_results après 0027 (lien club adverse + compétition). */
export const MATCH_RESULT_COLUMNS = [
  "id",
  "match_checkin_id",
  "club_id",
  "our_score",
  "opponent_score",
  "outcome",
  "mvp_user_id",
  "recorded_by",
  "created_at",
  "opponent_club_id",
  "competition_id",
] as const;

export const MATCH_OUTCOMES = ["WIN", "DRAW", "LOSS"] as const;
export type MatchResultOutcome = (typeof MATCH_OUTCOMES)[number];

/** Points CPC déterministes : victoire 3, nul 1, défaite 0. Jamais season_stats. */
export const COMPETITION_POINTS: Record<MatchResultOutcome, number> = {
  WIN: 3,
  DRAW: 1,
  LOSS: 0,
};

export function isCompetitionStatus(value: unknown): value is CompetitionStatus {
  return typeof value === "string" && (COMPETITION_STATUSES as readonly string[]).includes(value);
}

export function isCompetitionCreateStatus(value: unknown): value is CompetitionCreateStatus {
  return typeof value === "string" && (COMPETITION_CREATE_STATUSES as readonly string[]).includes(value);
}

export function normalizeCompetitionName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < COMPETITION_NAME_MIN || trimmed.length > COMPETITION_NAME_MAX) return null;
  return trimmed;
}

/** RLS `competitions_select_open_or_own` : OPEN pour tout authentifié, sinon créateur. */
export function competitionIsReadable(status: CompetitionStatus, createdBy: string, viewerId: string): boolean {
  if (status === "OPEN") return true;
  return createdBy === viewerId;
}

/** RLS `competitions_insert_creator` : created_by = JWT et statut DRAFT|OPEN. */
export function canInsertCompetition(input: {
  actorId: string;
  createdBy: string;
  status: string;
}): boolean {
  return input.actorId === input.createdBy && isCompetitionCreateStatus(input.status);
}

export type RegisterBlockReason = "not_open" | "not_manager" | "already_registered";

/**
 * Inscription OWNER/MANAGER d'un club sur une compétition OPEN.
 * `alreadyRegistered` reflète la contrainte unique : le 2e insert est un 409,
 * pas un 500 (idempotence).
 */
export function canRegisterCompetitionClub(input: {
  competitionStatus: string;
  actorRole: string | null;
  alreadyRegistered: boolean;
}): { ok: true } | { ok: false; reason: RegisterBlockReason } {
  if (input.competitionStatus !== "OPEN") return { ok: false, reason: "not_open" };
  if (input.actorRole !== "OWNER" && input.actorRole !== "MANAGER") {
    return { ok: false, reason: "not_manager" };
  }
  if (input.alreadyRegistered) return { ok: false, reason: "already_registered" };
  return { ok: true };
}

export function registerBlockHttpStatus(reason: RegisterBlockReason): 400 | 403 | 409 {
  if (reason === "already_registered") return REGISTER_CONFLICT_STATUS;
  if (reason === "not_manager") return 403;
  return 400;
}

export function registerBlockMessage(reason: RegisterBlockReason): string {
  if (reason === "already_registered") return COMPETITION_COPY.registerConflict;
  if (reason === "not_manager") return COMPETITION_COPY.notManager;
  return COMPETITION_COPY.notOpen;
}

/** Unique Postgres → HTTP 409. Tout autre code n'est pas un conflit d'inscription. */
export function uniqueViolationHttpStatus(code: string | undefined | null): 409 | null {
  return code === POSTGRES_UNIQUE_VIOLATION ? REGISTER_CONFLICT_STATUS : null;
}

export function isMatchResultOutcome(value: unknown): value is MatchResultOutcome {
  return typeof value === "string" && (MATCH_OUTCOMES as readonly string[]).includes(value);
}

export function inverseMatchOutcome(outcome: MatchResultOutcome): MatchResultOutcome {
  if (outcome === "WIN") return "LOSS";
  if (outcome === "LOSS") return "WIN";
  return "DRAW";
}

/**
 * Schéma : les colonnes de lien existent (0027). Ne dit PAS qu'un classement
 * est affichable — il faut aussi au moins une ligne réellement liée.
 */
export function canFillStandingsFromMatchResults(
  columns: readonly string[] = MATCH_RESULT_COLUMNS
): boolean {
  return columns.includes("competition_id") && columns.includes("opponent_club_id");
}

export interface LinkedMatchResultInput {
  club_id: string;
  opponent_club_id: string | null;
  competition_id: string | null;
  outcome: string;
  our_score: number;
  opponent_score: number;
}

export function isLinkedCompetitionResult(
  row: LinkedMatchResultInput,
  competitionId: string
): boolean {
  return (
    row.competition_id === competitionId &&
    typeof row.opponent_club_id === "string" &&
    row.opponent_club_id.length > 0 &&
    row.opponent_club_id !== row.club_id &&
    isMatchResultOutcome(row.outcome)
  );
}

/** Au moins une ligne match_results liée à CETTE compétition (club + adverse). */
export function hasLinkedCompetitionResults(
  rows: readonly LinkedMatchResultInput[],
  competitionId: string
): boolean {
  return rows.some((row) => isLinkedCompetitionResult(row, competitionId));
}

export function canShowCompetitionStandings(
  rows: readonly LinkedMatchResultInput[],
  competitionId: string,
  columns: readonly string[] = MATCH_RESULT_COLUMNS
): boolean {
  return canFillStandingsFromMatchResults(columns) && hasLinkedCompetitionResults(rows, competitionId);
}

export interface CompetitionStandingRow {
  clubId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

function emptyStanding(clubId: string): CompetitionStandingRow {
  return {
    clubId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

function applyOutcome(standing: CompetitionStandingRow, outcome: MatchResultOutcome, gf: number, ga: number) {
  standing.played += 1;
  standing.goalsFor += gf;
  standing.goalsAgainst += ga;
  standing.points += COMPETITION_POINTS[outcome];
  if (outcome === "WIN") standing.wins += 1;
  else if (outcome === "DRAW") standing.draws += 1;
  else standing.losses += 1;
}

/**
 * Classement déterministe depuis les match_results liés uniquement.
 * Chaque ligne crédite les deux clubs (enregistreur + adverse). Clubs
 * inscrits sans match : absents (pas de row 0-0-0 inventée).
 * Tri : points DESC, différence de buts DESC, buts pour DESC, clubId ASC.
 * Ne lit jamais season_stats.
 */
export function computeCompetitionStandings(
  rows: readonly LinkedMatchResultInput[],
  competitionId: string
): CompetitionStandingRow[] {
  const byClub = new Map<string, CompetitionStandingRow>();

  for (const row of rows) {
    if (!isLinkedCompetitionResult(row, competitionId)) continue;
    const outcome = row.outcome as MatchResultOutcome;
    const opponentId = row.opponent_club_id as string;
    const home = byClub.get(row.club_id) ?? emptyStanding(row.club_id);
    const away = byClub.get(opponentId) ?? emptyStanding(opponentId);
    applyOutcome(home, outcome, row.our_score, row.opponent_score);
    applyOutcome(away, inverseMatchOutcome(outcome), row.opponent_score, row.our_score);
    byClub.set(row.club_id, home);
    byClub.set(opponentId, away);
  }

  return [...byClub.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubId < b.clubId ? -1 : a.clubId > b.clubId ? 1 : 0;
  });
}

const REQUIRED_SQL_FRAGMENTS = [
  "create table if not exists public.competitions",
  "create table if not exists public.competition_clubs",
  "constraint competition_clubs_pair_unique unique (competition_id, club_id)",
  "check (status in ('DRAFT', 'OPEN', 'CLOSED'))",
  "competitions_select_open_or_own",
  "competitions_insert_creator",
  "competition_clubs_insert_manager",
  "grant all privileges on public.competitions to service_role",
] as const;

const FORBIDDEN_SQL_FRAGMENTS = [
  "create table if not exists public.standings",
  "create table if not exists public.competition_standings",
  "create table if not exists public.league_standings",
  "alter table public.match_results",
  "alter table public.match_checkins",
] as const;

/** Vérifie le SQL fondation 0026 (texte) : tables + RLS + unique, pas de 2e moteur. */
export function competitionsFoundationSqlIssues(sql: string): string[] {
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

const REQUIRED_LINK_SQL_FRAGMENTS = [
  "alter table public.match_results",
  "opponent_club_id",
  "competition_id",
  "opponent_club_id is distinct from club_id",
  "create or replace function public.finalize_match",
  "p_opponent_club_id",
  "p_competition_id",
  "clubs_not_in_competition",
  "grant execute on function public.finalize_match",
  "to service_role",
] as const;

const FORBIDDEN_LINK_SQL_FRAGMENTS = [
  "create table if not exists public.standings",
  "create table if not exists public.competition_standings",
  "create table if not exists public.league_standings",
  "for insert to authenticated",
  "prisma migrate deploy",
] as const;

/** Vérifie le SQL 0027 : lien match_results, pas de table standings, pas d'INSERT client. */
export function matchResultLinkSqlIssues(sql: string): string[] {
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");
  const issues: string[] = [];
  for (const fragment of REQUIRED_LINK_SQL_FRAGMENTS) {
    if (!normalized.includes(fragment.toLowerCase())) {
      issues.push(`manque: ${fragment}`);
    }
  }
  for (const fragment of FORBIDDEN_LINK_SQL_FRAGMENTS) {
    if (normalized.includes(fragment.toLowerCase())) {
      issues.push(`interdit: ${fragment}`);
    }
  }
  return issues;
}

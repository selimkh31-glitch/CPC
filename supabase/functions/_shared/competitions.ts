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
  detailLoadError: "Impossible de charger cette compétition.",
  registerConflict: "Ce club Pro Clubs est déjà inscrit à cette compétition.",
  notOpen: "Les inscriptions ne sont ouvertes que pour une compétition OPEN.",
  notManager: "Tu n'es pas owner ou manager de ce club Pro Clubs.",
  competitionNotFound: "Compétition introuvable.",
  created: "Compétition Pro Clubs créée.",
  registered: "Club inscrit à la compétition.",
  draftCannotRegister: "Les clubs ne peuvent pas s'inscrire : cette compétition est encore en brouillon.",
  closedCannotRegister: "Les inscriptions sont fermées.",
  createOwnerHint: "Tu en seras le créateur. Un brouillon reste invisible aux autres, et aucun club ne peut s'y inscrire.",
  draftCreateHint: "Visible seulement par toi. Les clubs ne peuvent pas s'inscrire tant qu'elle n'est pas ouverte.",
  openCreateHint: "Les clubs Pro Clubs gérés (owner ou manager) peuvent s'inscrire.",
  creatorLabel: "Créateur",
  participantsTitle: "Clubs inscrits",
  participantsEmpty: "Aucun club Pro Clubs inscrit.",
  openJoinHint: "Ouverte — les clubs Pro Clubs gérés (owner ou manager) peuvent s'inscrire.",
  standingsTitle: "Classement",
  standingsEmpty: "Pas de classement tant qu'aucun match lié n'a été enregistré pour cette compétition.",
  standingsEmptyHint:
    "Le classement se calcule uniquement depuis des résultats Pro Clubs avec un club adverse CPC et cette compétition. Aucun point inventé.",
  standingsLoadError: "Impossible de charger les résultats liés.",
  linkedMatchesTitle: "Matchs liés",
  linkedMatchesEmpty: "Pas encore de match lié",
  linkedMatchesEmptyHint:
    "Seuls les résultats Pro Clubs enregistrés avec un club adverse CPC et cette compétition apparaissent ici.",
  linkedMatchesLoadError: "Impossible de charger les matchs liés.",
  linkedMatchRecorded: "Enregistré",
  linkedMatchIncomplete: "Pas encore de score",
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
  linkedResultCta: "Voir la compétition",
} as const;

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  DRAFT: "Brouillon",
  OPEN: "Ouverte",
  CLOSED: "Fermée",
};

/** Deep link détail — stack `/competitions/[id]`, pas un onglet. Liste si id absent. */
export function competitionDetailHref(competitionId: string | null | undefined): string {
  if (typeof competitionId === "string" && competitionId.length > 0) {
    return `/competitions/${competitionId}`;
  }
  return "/competitions";
}

/**
 * Deep link après un résultat / une notif liés : tournoi → `/tournaments/[id]`,
 * sinon `/competitions/[id]`. Sans kind (notif ancienne) → compétition ;
 * le détail compétition redirige encore un kind TOURNAMENT.
 */
export function competitionOrTournamentHref(
  competitionId: string | null | undefined,
  kind?: string | null
): string {
  const id = typeof competitionId === "string" && competitionId.length > 0 ? competitionId : null;
  if (kind === "TOURNAMENT") return id ? `/tournaments/${id}` : "/tournaments";
  return id ? `/competitions/${id}` : "/competitions";
}

export type CompetitionRegisterCtaKind =
  | "register"
  | "already_registered"
  | "draft"
  | "closed"
  | "no_managed_club";

/**
 * CTA d'inscription honnête : jamais un bouton mort sur DRAFT/CLOSED.
 * OPEN + OWNER/MANAGER + pas encore inscrit → bouton. Doublon → copy 409.
 */
export function competitionRegisterCtaKind(input: {
  status: string;
  hasManagedClub: boolean;
  alreadyRegistered: boolean;
}): CompetitionRegisterCtaKind {
  if (input.alreadyRegistered) return "already_registered";
  if (input.status === "DRAFT") return "draft";
  if (input.status !== "OPEN") return "closed";
  if (!input.hasManagedClub) return "no_managed_club";
  return "register";
}

/** Nom du créateur : username réel, sinon « Toi » si viewer = created_by. Pas de pseudo inventé. */
export function competitionCreatorLabel(
  competition: { created_by: string; creator?: { username?: string | null } | null },
  viewerId: string | null
): string {
  const username = competition.creator?.username?.trim();
  if (username) return username;
  if (viewerId && competition.created_by === viewerId) return "Toi";
  return "Joueur Pro Clubs";
}

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

/** Ligne réellement liée à CETTE compétition (club + adverse). Outcome non requis — liste. */
export function isCompetitionLinkedMatchRow(
  row: {
    club_id: string;
    opponent_club_id: string | null;
    competition_id: string | null;
  },
  competitionId: string
): boolean {
  return (
    row.competition_id === competitionId &&
    typeof row.opponent_club_id === "string" &&
    row.opponent_club_id.length > 0 &&
    row.opponent_club_id !== row.club_id
  );
}

export function isLinkedCompetitionResult(
  row: LinkedMatchResultInput,
  competitionId: string
): boolean {
  return isCompetitionLinkedMatchRow(row, competitionId) && isMatchResultOutcome(row.outcome);
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

/** Tri unique : points → GD → GF → clubId. Famille scorer compétitions + classement CPC. */
export function compareStandingRows(a: CompetitionStandingRow, b: CompetitionStandingRow): number {
  if (b.points !== a.points) return b.points - a.points;
  const gdA = a.goalsFor - a.goalsAgainst;
  const gdB = b.goalsFor - b.goalsAgainst;
  if (gdB !== gdA) return gdB - gdA;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.clubId < b.clubId ? -1 : a.clubId > b.clubId ? 1 : 0;
}

/**
 * Scorer unique : chaque ligne incluse crédite les deux clubs (W=3 D=1 L=0).
 * Clubs sans match inclus : absents (pas de row 0-0-0 inventée).
 * Ne lit jamais season_stats.
 */
export function computeStandingsFromLinkedResults(
  rows: readonly LinkedMatchResultInput[],
  include: (row: LinkedMatchResultInput) => boolean
): CompetitionStandingRow[] {
  const byClub = new Map<string, CompetitionStandingRow>();

  for (const row of rows) {
    if (!include(row) || !isMatchResultOutcome(row.outcome)) continue;
    const opponentId = row.opponent_club_id;
    if (typeof opponentId !== "string" || opponentId.length === 0 || opponentId === row.club_id) {
      continue;
    }
    const home = byClub.get(row.club_id) ?? emptyStanding(row.club_id);
    const away = byClub.get(opponentId) ?? emptyStanding(opponentId);
    applyOutcome(home, row.outcome, row.our_score, row.opponent_score);
    applyOutcome(away, inverseMatchOutcome(row.outcome), row.opponent_score, row.our_score);
    byClub.set(row.club_id, home);
    byClub.set(opponentId, away);
  }

  return [...byClub.values()].sort(compareStandingRows);
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
  return computeStandingsFromLinkedResults(rows, (row) => isLinkedCompetitionResult(row, competitionId));
}

export type LinkedMatchStatus = "recorded" | "incomplete";

/**
 * Score affiché seulement si les deux entiers sont réellement présents.
 * Un 0-0 n'apparaît que si les deux scores persistés valent 0 — jamais un faux 0-0.
 */
export function formatLinkedMatchScore(ourScore: unknown, opponentScore: unknown): string | null {
  if (typeof ourScore !== "number" || typeof opponentScore !== "number") return null;
  if (!Number.isFinite(ourScore) || !Number.isFinite(opponentScore)) return null;
  return `${ourScore} — ${opponentScore}`;
}

export function linkedMatchStatus(ourScore: unknown, opponentScore: unknown): LinkedMatchStatus {
  return formatLinkedMatchScore(ourScore, opponentScore) ? "recorded" : "incomplete";
}

export function linkedMatchStatusLabel(status: LinkedMatchStatus): string {
  return status === "recorded" ? COMPETITION_COPY.linkedMatchRecorded : COMPETITION_COPY.linkedMatchIncomplete;
}

export interface LinkedMatchListInput {
  id: string;
  club_id: string;
  opponent_club_id: string | null;
  competition_id: string | null;
  outcome?: unknown;
  our_score?: unknown;
  opponent_score?: unknown;
  created_at?: string | null;
  club?: { id?: string; name?: string | null } | null;
  opponent_club?: { id?: string; name?: string | null } | null;
}

export interface CompetitionLinkedMatchItem {
  id: string;
  clubId: string;
  opponentClubId: string;
  /** Nom réel hydraté — `null` si manquant / placeholder, jamais inventé. */
  clubName: string | null;
  opponentClubName: string | null;
  /** Noms réels joints par « — ». Un seul côté suffit. Aucun → `null` (pas un placeholder). */
  clubsLine: string | null;
  status: LinkedMatchStatus;
  statusLabel: string;
  scoreLine: string | null;
  outcome: MatchResultOutcome | null;
  createdAt: string | null;
}

/**
 * Nom affichable : uniquement un nom réel hydraté.
 * Même doctrine que `tournamentClubDisplayName` (feuille sans import croisé) :
 * refuse « Club Pro Clubs » / « Club ». Vide / absent → null.
 */
function honestClubDisplayName(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed === "Club Pro Clubs" || trimmed === "Club") return null;
  return trimmed;
}

function nameFromLinkedMatch(
  clubId: string,
  names: Map<string, string> | Record<string, string> | undefined,
  embeddedName?: string | null
): string | null {
  const fromEmbed = honestClubDisplayName(embeddedName);
  if (fromEmbed) return fromEmbed;
  if (!names) return null;
  const raw = names instanceof Map ? names.get(clubId) : names[clubId];
  return honestClubDisplayName(raw);
}

function linkedMatchClubsLine(clubName: string | null, opponentClubName: string | null): string | null {
  if (clubName && opponentClubName) return `${clubName} — ${opponentClubName}`;
  return clubName ?? opponentClubName;
}

/**
 * Matchs réellement liés à CETTE compétition (competition_id + opponent_club_id).
 * Même source que le classement. Score manquant → « Pas encore de score », jamais 0-0 inventé.
 */
export function listCompetitionLinkedMatches(
  rows: readonly LinkedMatchListInput[],
  competitionId: string,
  names?: Map<string, string> | Record<string, string>
): CompetitionLinkedMatchItem[] {
  const items: CompetitionLinkedMatchItem[] = [];
  for (const row of rows) {
    if (!row.id || !isCompetitionLinkedMatchRow(row, competitionId)) continue;
    const opponentClubId = row.opponent_club_id as string;
    const scoreLine = formatLinkedMatchScore(row.our_score, row.opponent_score);
    const status = scoreLine ? "recorded" : "incomplete";
    const clubName = nameFromLinkedMatch(row.club_id, names, row.club?.name);
    const opponentClubName = nameFromLinkedMatch(opponentClubId, names, row.opponent_club?.name);
    items.push({
      id: row.id,
      clubId: row.club_id,
      opponentClubId,
      clubName,
      opponentClubName,
      clubsLine: linkedMatchClubsLine(clubName, opponentClubName),
      status,
      statusLabel: linkedMatchStatusLabel(status),
      scoreLine,
      outcome: status === "recorded" && isMatchResultOutcome(row.outcome) ? row.outcome : null,
      createdAt: typeof row.created_at === "string" && row.created_at.length > 0 ? row.created_at : null,
    });
  }
  return items.sort((a, b) => {
    if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    if (a.createdAt && !b.createdAt) return -1;
    if (!a.createdAt && b.createdAt) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export type CompetitionLinkedMatchNav = {
  href: string;
  selectClubId: string | null;
  requireClubMode: boolean;
};

/**
 * Tap : `/match` si le viewer est OWNER/MANAGER du club enregistreur
 * (`club_id` — `/match` est la feuille du club géré). Sinon profil public
 * `/club/[id]` du club enregistreur — jamais un row mort, jamais `/match-sheet`.
 */
export function competitionLinkedMatchNav(input: {
  recordingClubId: string;
  managedClubIds: readonly string[];
}): CompetitionLinkedMatchNav | null {
  const recordingClubId = input.recordingClubId.trim();
  if (!recordingClubId) return null;
  if (input.managedClubIds.includes(recordingClubId)) {
    return { href: "/match", selectClubId: recordingClubId, requireClubMode: true };
  }
  return { href: `/club/${recordingClubId}`, selectClubId: null, requireClubMode: false };
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
  "when unique_violation then",
  "grant execute on function public.finalize_match",
  "to service_role",
] as const;

const FORBIDDEN_LINK_SQL_FRAGMENTS = [
  "create table if not exists public.standings",
  "create table if not exists public.competition_standings",
  "create table if not exists public.league_standings",
  "for insert to authenticated",
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

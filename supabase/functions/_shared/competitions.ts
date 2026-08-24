/**
 * Compétitions virtuelles EA SPORTS FC 27 Pro Clubs — fondation.
 *
 * SOURCE DE VÉRITÉ UNIQUE pour le statut, la validation du nom, les
 * prédicats RLS (lecture / création / inscription) et l'idempotence 409.
 * Edge Functions : import `../_shared/competitions.ts`. App mobile :
 * `lib/competitions.ts` (réexport). Aucun classement, aucun score inventé.
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
} as const;

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  DRAFT: "Brouillon",
  OPEN: "Ouverte",
  CLOSED: "Fermée",
};

const MATCH_RESULT_COLUMNS = [
  "id",
  "match_checkin_id",
  "club_id",
  "our_score",
  "opponent_score",
  "outcome",
  "mvp_user_id",
  "recorded_by",
  "created_at",
] as const;

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

/**
 * Classement compétition : uniquement si on peut le remplir depuis
 * `match_results` existants. Aujourd'hui impossible (pas de competition_id,
 * pas de club adverse). Ne jamais inventer de standings.
 */
export function canFillStandingsFromMatchResults(
  columns: readonly string[] = MATCH_RESULT_COLUMNS
): boolean {
  return columns.includes("competition_id") && columns.includes("opponent_club_id");
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

/** Vérifie le SQL fondation (texte) : tables + RLS + unique, pas de 2e moteur de résultats. */
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

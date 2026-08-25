/**
 * Match Result Engine — gardes finalize-match (Edge + miroir RPC 0014/0027).
 *
 * SOURCE DE VÉRITÉ UNIQUE pour : scores (entiers 0–99), rôle OWNER/MANAGER,
 * outcome serveur (WIN/DRAW/LOSS), unique match_checkin_id → 409 FR,
 * compétition seulement si les DEUX clubs sont dans competition_clubs,
 * refus d'un adversaire dont le owner est bloqué (les deux sens).
 *
 * Edge : import `../_shared/finalizeMatch.ts`. App : `lib/finalizeMatch.ts`.
 * `outcome` n'est jamais reçu du client. Pas de table standings, pas de
 * season_stats, pas d'INSERT client. Fichier feuille (pas d'import _shared)
 * pour rester dual Deno Edge / tsc app, comme competitions.ts / safety.ts.
 */

/** Postgres unique_violation — même code que l'inscription compétition. */
export const POSTGRES_UNIQUE_VIOLATION = "23505";

export const FINALIZE_SCORE_MIN = 0;
export const FINALIZE_SCORE_MAX = 99;

export const MATCH_RESULT_UNIQUE_CONSTRAINT = "match_results_match_checkin_id_key";

export const FINALIZE_MATCH_COPY = {
  alreadyFinalized: "Ce match a déjà un résultat enregistré.",
  notAuthorized: "Tu n'es pas owner ou manager de ce club.",
  invalidScore: "Score invalide. Utilise des entiers de 0 à 99.",
  checkinNotFound: "Match introuvable.",
  mvpNotPresent: "Le MVP doit avoir été présent à ce match.",
  opponentIsSelf: "Le club adverse doit être distinct du tien.",
  opponentNotFound: "Club adverse introuvable.",
  opponentBlocked: "Tu ne peux pas enregistrer un résultat contre ce club (blocage).",
  competitionRequiresOpponent: "Une compétition ne peut être liée que si un club adverse est choisi.",
  competitionNotFound: "Compétition introuvable.",
  competitionNotOpen: "On ne peut lier qu'une compétition ouverte.",
  clubsNotInCompetition: "Les deux clubs doivent être inscrits à cette compétition.",
  scoresRequired: "Saisis les deux scores (entiers de 0 à 99).",
  competitionNeedOpponent:
    "Choisis d'abord le club adverse. Une compétition n'est proposée que si les deux clubs y sont inscrits.",
  invitationsHint: "Les invitations se gèrent depuis Recrutement — ici elles sont seulement listées.",
} as const;

export const FINALIZE_MATCH_ERROR_CODES = [
  "invalid_score",
  "checkin_not_found",
  "not_authorized",
  "already_finalized",
  "mvp_not_present",
  "opponent_is_self",
  "opponent_not_found",
  "opponent_owner_blocked",
  "competition_requires_opponent",
  "competition_not_found",
  "competition_not_open",
  "clubs_not_in_competition",
] as const;

export type FinalizeMatchErrorCode = (typeof FINALIZE_MATCH_ERROR_CODES)[number];

export type MatchResultOutcome = "WIN" | "DRAW" | "LOSS";

export type ClubStaffRole = "OWNER" | "MANAGER" | "MEMBER";

/** OWNER/MANAGER seulement — MEMBER (et absence de rôle) → not_authorized. */
export function canFinalizeMatchRole(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "MANAGER";
}

/** Entier 0–99. Les strings / floats / négatifs sont refusés (garde Edge). */
export function isValidFinalizeScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= FINALIZE_SCORE_MIN && value <= FINALIZE_SCORE_MAX;
}

/**
 * Saisie UI (digits seulement). Vide / hors bornes → null, jamais un faux 0.
 */
export function parseUiMatchScore(raw: string): number | null {
  if (raw === "") return null;
  if (!/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return isValidFinalizeScore(n) ? n : null;
}

/** `outcome` toujours calculé serveur, jamais lu depuis le client. */
export function computeMatchOutcome(ourScore: number, opponentScore: number): MatchResultOutcome {
  if (ourScore > opponentScore) return "WIN";
  if (ourScore < opponentScore) return "LOSS";
  return "DRAW";
}

/**
 * Unique `match_results.match_checkin_id` (0014) — course concurrente ou
 * 2e appel après le pré-check RPC. 23505 → même 409 FR que already_finalized.
 */
export function isMatchResultsUniqueViolation(code: string | null | undefined, message: string): boolean {
  if (code === POSTGRES_UNIQUE_VIOLATION) return true;
  const lower = message.toLowerCase();
  if (lower.includes(MATCH_RESULT_UNIQUE_CONSTRAINT)) return true;
  return lower.includes("duplicate key") && lower.includes("match_results");
}

export function mapFinalizeError(
  message: string,
  code?: string | null
): { text: string; status: number; errorCode: FinalizeMatchErrorCode | "unknown" } {
  if (isMatchResultsUniqueViolation(code, message) || message.includes("already_finalized")) {
    return { text: FINALIZE_MATCH_COPY.alreadyFinalized, status: 409, errorCode: "already_finalized" };
  }
  if (message.includes("checkin_not_found")) {
    return { text: FINALIZE_MATCH_COPY.checkinNotFound, status: 404, errorCode: "checkin_not_found" };
  }
  if (message.includes("not_authorized")) {
    return { text: FINALIZE_MATCH_COPY.notAuthorized, status: 403, errorCode: "not_authorized" };
  }
  if (message.includes("invalid_score")) {
    return { text: FINALIZE_MATCH_COPY.invalidScore, status: 400, errorCode: "invalid_score" };
  }
  if (message.includes("mvp_not_present")) {
    return { text: FINALIZE_MATCH_COPY.mvpNotPresent, status: 400, errorCode: "mvp_not_present" };
  }
  if (message.includes("opponent_is_self")) {
    return { text: FINALIZE_MATCH_COPY.opponentIsSelf, status: 400, errorCode: "opponent_is_self" };
  }
  if (message.includes("opponent_not_found")) {
    return { text: FINALIZE_MATCH_COPY.opponentNotFound, status: 404, errorCode: "opponent_not_found" };
  }
  if (message.includes("opponent_owner_blocked")) {
    return { text: FINALIZE_MATCH_COPY.opponentBlocked, status: 403, errorCode: "opponent_owner_blocked" };
  }
  if (message.includes("competition_requires_opponent")) {
    return { text: FINALIZE_MATCH_COPY.competitionRequiresOpponent, status: 400, errorCode: "competition_requires_opponent" };
  }
  if (message.includes("competition_not_found")) {
    return { text: FINALIZE_MATCH_COPY.competitionNotFound, status: 404, errorCode: "competition_not_found" };
  }
  if (message.includes("competition_not_open")) {
    return { text: FINALIZE_MATCH_COPY.competitionNotOpen, status: 400, errorCode: "competition_not_open" };
  }
  if (message.includes("clubs_not_in_competition")) {
    return { text: FINALIZE_MATCH_COPY.clubsNotInCompetition, status: 400, errorCode: "clubs_not_in_competition" };
  }
  return { text: message, status: 500, errorCode: "unknown" };
}

/**
 * Même règle que la recherche d'adversaire (`filterClubsHiddenByBlock`) :
 * owner du club adverse dans le set bidirectionnel → l'Edge refuse.
 * Self n'est pas un blocage (RPC `opponent_is_self`).
 */
export function shouldRefuseFinalizeOpponentOwner(input: {
  actorId: string;
  opponentOwnerId: string | null | undefined;
  blockedIds: Iterable<string>;
}): boolean {
  const ownerId = input.opponentOwnerId;
  if (!ownerId) return false;
  if (ownerId === input.actorId) return false;
  const set = input.blockedIds instanceof Set ? input.blockedIds : new Set(input.blockedIds);
  return set.has(ownerId);
}

export type FinalizeMatchGuardInput = {
  actorRole: string | null;
  checkinExists: boolean;
  alreadyFinalized: boolean;
  ourScore: unknown;
  opponentScore: unknown;
  recordingClubId: string;
  opponentClubId: string | null;
  opponentClubExists: boolean;
  opponentOwnerId: string | null;
  actorId: string;
  blockedIds: Iterable<string>;
  competitionId: string | null;
  /** null = compétition inconnue (si competitionId posé). */
  competitionStatus: string | null;
  recordingClubRegistered: boolean;
  opponentClubRegistered: boolean;
  mvpUserId: string | null;
  mvpIsPresent: boolean;
};

export type FinalizeMatchPersisted = {
  ourScore: number;
  opponentScore: number;
  outcome: MatchResultOutcome;
  opponentClubId: string | null;
  competitionId: string | null;
};

export type FinalizeMatchGuardResult =
  | { ok: true; result: FinalizeMatchPersisted }
  | { ok: false; code: FinalizeMatchErrorCode };

/**
 * Miroir des gardes RPC 0027 + garde Edge `opponent_owner_blocked`.
 * Ordre aligné sur `finalize_match` puis blocage owner (Edge, avant INSERT).
 *
 * Règle 0027 : si `competition_id` est posé et qu'un club n'est pas inscrit,
 * le RPC/trigger **rejette toute la ligne** (`clubs_not_in_competition`) —
 * on ne strippe pas le champ pour sauver un amical. Zéro impact classement.
 */
export function evaluateFinalizeMatch(input: FinalizeMatchGuardInput): FinalizeMatchGuardResult {
  if (!isValidFinalizeScore(input.ourScore) || !isValidFinalizeScore(input.opponentScore)) {
    return { ok: false, code: "invalid_score" };
  }
  if (!input.checkinExists) return { ok: false, code: "checkin_not_found" };
  if (!canFinalizeMatchRole(input.actorRole)) return { ok: false, code: "not_authorized" };
  if (input.alreadyFinalized) return { ok: false, code: "already_finalized" };
  if (input.mvpUserId && !input.mvpIsPresent) return { ok: false, code: "mvp_not_present" };

  const opponentClubId = input.opponentClubId;
  if (opponentClubId) {
    if (opponentClubId === input.recordingClubId) return { ok: false, code: "opponent_is_self" };
    if (!input.opponentClubExists) return { ok: false, code: "opponent_not_found" };
    if (
      shouldRefuseFinalizeOpponentOwner({
        actorId: input.actorId,
        opponentOwnerId: input.opponentOwnerId,
        blockedIds: input.blockedIds,
      })
    ) {
      return { ok: false, code: "opponent_owner_blocked" };
    }
  }

  const competitionId = input.competitionId;
  if (competitionId) {
    if (!opponentClubId) return { ok: false, code: "competition_requires_opponent" };
    if (input.competitionStatus == null) return { ok: false, code: "competition_not_found" };
    if (input.competitionStatus !== "OPEN") return { ok: false, code: "competition_not_open" };
    if (!input.recordingClubRegistered || !input.opponentClubRegistered) {
      return { ok: false, code: "clubs_not_in_competition" };
    }
  }

  return {
    ok: true,
    result: {
      ourScore: input.ourScore,
      opponentScore: input.opponentScore,
      outcome: computeMatchOutcome(input.ourScore, input.opponentScore),
      opponentClubId,
      competitionId,
    },
  };
}

const REQUIRED_FINALIZE_SQL_FRAGMENTS = [
  "create or replace function public.finalize_match",
  "p_opponent_club_id",
  "p_competition_id",
  "raise exception 'already_finalized'",
  "raise exception 'not_authorized'",
  "raise exception 'invalid_score'",
  "raise exception 'clubs_not_in_competition'",
  "when unique_violation then",
  "grant execute on function public.finalize_match",
  "to service_role",
  "revoke execute on function public.finalize_match",
] as const;

const FORBIDDEN_FINALIZE_SQL_FRAGMENTS = [
  "create table if not exists public.standings",
  "for insert to authenticated",
] as const;

/** Contrat SQL 0027 (finalize_match) : unique → already_finalized, pas d'INSERT client. */
export function finalizeMatchSqlIssues(sql: string): string[] {
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");
  const issues: string[] = [];
  for (const fragment of REQUIRED_FINALIZE_SQL_FRAGMENTS) {
    if (!normalized.includes(fragment.toLowerCase())) {
      issues.push(`manque: ${fragment}`);
    }
  }
  for (const fragment of FORBIDDEN_FINALIZE_SQL_FRAGMENTS) {
    if (normalized.includes(fragment.toLowerCase())) {
      issues.push(`interdit: ${fragment}`);
    }
  }
  return issues;
}

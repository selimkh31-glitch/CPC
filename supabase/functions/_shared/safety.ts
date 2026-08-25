/**
 * Safety + notifications in-app — source unique Edge/app (réexport lib/safety.ts).
 * Logique pure : aucun I/O. Un block est bidirectionnel pour le produit
 * (A bloque B ⇒ A et B ne se voient plus / n'interagissent plus).
 */

export const REPORT_REASONS = ["HARASSMENT", "CHEATING", "FAKE_IDENTITY", "SPAM", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  HARASSMENT: "Harcèlement",
  CHEATING: "Triche (Pro Clubs)",
  FAKE_IDENTITY: "Fausse identité",
  SPAM: "Spam",
  OTHER: "Autre",
};

export const REPORT_STATUSES = ["OPEN", "REVIEWED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "APPLICATION_RECEIVED",
  "APPLICATION_ACCEPTED",
  "APPLICATION_DECLINED",
  "INVITATION_RECEIVED",
  "INVITATION_ACCEPTED",
  "INVITATION_DECLINED",
  "MESSAGE_RECEIVED",
  "MATCH_FINALIZED",
  "COMPETITION_CLUB_REGISTERED",
  "TOURNAMENT_ROUND_SCHEDULED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Labels in-app (FR, FC 27 Pro Clubs) — source unique titre / type. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  APPLICATION_RECEIVED: "Nouvelle candidature",
  APPLICATION_ACCEPTED: "Candidature acceptée",
  APPLICATION_DECLINED: "Candidature refusée",
  INVITATION_RECEIVED: "Invitation reçue",
  INVITATION_ACCEPTED: "Invitation acceptée",
  INVITATION_DECLINED: "Invitation déclinée",
  MESSAGE_RECEIVED: "Nouveau message",
  MATCH_FINALIZED: "Résultat de match",
  COMPETITION_CLUB_REGISTERED: "Club inscrit",
  TOURNAMENT_ROUND_SCHEDULED: "Tour programmé",
};

export const EA_IDENTITY_KINDS = ["NONE", "USERNAME_EQUALITY"] as const;
export type EaIdentityKind = (typeof EA_IDENTITY_KINDS)[number];

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function pairIsBlocked(
  blocks: readonly { blocker_id: string; blocked_id: string }[],
  a: string,
  b: string
): boolean {
  if (a === b) return false;
  return blocks.some(
    (row) =>
      (row.blocker_id === a && row.blocked_id === b) || (row.blocker_id === b && row.blocked_id === a)
  );
}

/** Ids à cacher pour `selfId` (ceux que j'ai bloqués + ceux qui m'ont bloqué). */
export function otherIdsFromBlocks(
  blocks: readonly { blocker_id: string; blocked_id: string }[],
  selfId: string
): string[] {
  const ids = new Set<string>();
  for (const row of blocks) {
    if (row.blocker_id === selfId) ids.add(row.blocked_id);
    else if (row.blocked_id === selfId) ids.add(row.blocker_id);
  }
  return [...ids];
}

/**
 * LIVE / matching / annuaire / recherche d'adversaire : un club dont le
 * owner est dans la paire bloquée (les deux sens) est masqué. `blockedIds`
 * vient de `my_blocked_user_ids` / `otherIdsFromBlocks`.
 */
export type ClubOwnerBlockFields = {
  owner_id?: string | null;
  owner?: { id?: string | null } | null;
};

export function isClubHiddenByBlock(
  club: ClubOwnerBlockFields | null | undefined,
  blockedIds: Iterable<string>
): boolean {
  if (!club) return false;
  const set = blockedIds instanceof Set ? blockedIds : new Set(blockedIds);
  if (club.owner_id && set.has(club.owner_id)) return true;
  if (club.owner?.id && set.has(club.owner.id)) return true;
  return false;
}

export function filterClubsHiddenByBlock<T extends ClubOwnerBlockFields>(
  clubs: readonly T[],
  blockedIds: Iterable<string>
): T[] {
  return clubs.filter((club) => !isClubHiddenByBlock(club, blockedIds));
}

/**
 * CTA Message / contacter (profils, membres) : masqué si la paire est
 * bloquée. Compétitions n'affichent pas de user contactable — n'invente
 * pas de policy d'inscription.
 */
export function shouldHideContactCta(
  otherUserId: string | null | undefined,
  blockedIds: Iterable<string> | null | undefined
): boolean {
  if (!otherUserId) return false;
  const set = blockedIds instanceof Set ? blockedIds : new Set(blockedIds ?? []);
  return set.has(otherUserId);
}

export function notificationTitle(type: string, fallback: string): string {
  return isNotificationType(type) ? NOTIFICATION_TYPE_LABELS[type] : fallback;
}

export function conversationIdFromNotificationData(
  data: Record<string, unknown> | null | undefined
): string | null {
  const id = data?.conversationId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function clubIdFromNotificationData(
  data: Record<string, unknown> | null | undefined
): string | null {
  const id = data?.clubId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function competitionIdFromNotificationData(
  data: Record<string, unknown> | null | undefined
): string | null {
  const id = data?.competitionId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** `kind` persisté sur les notifs liées (TOURNAMENT → /tournaments/[id]). */
export function competitionKindFromNotificationData(
  data: Record<string, unknown> | null | undefined
): "COMPETITION" | "TOURNAMENT" | null {
  const kind = data?.kind;
  if (kind === "TOURNAMENT" || kind === "COMPETITION") return kind;
  return null;
}

/** Autres membres d'une conversation, hors expéditeur (DIRECT = 1, GROUP = N). */
export function otherConversationParticipantIds(
  memberUserIds: readonly string[],
  senderId: string
): string[] {
  return [...new Set(memberUserIds.filter((id) => id.length > 0 && id !== senderId))];
}

/**
 * Un MESSAGE_RECEIVED in-app seulement pour un DM réel, destinataire ≠
 * expéditeur, paire non bloquée, message non soft-deleted.
 */
export function shouldNotifyMessageReceived(input: {
  conversationType: string;
  senderId: string;
  recipientId: string;
  blocked: boolean;
  deleted?: boolean;
}): boolean {
  if (input.conversationType !== "DIRECT") return false;
  if (!input.recipientId || input.recipientId === input.senderId) return false;
  if (input.blocked) return false;
  if (input.deleted) return false;
  return true;
}

export function messageReceivedCopy(senderUsername: string): {
  type: NotificationType;
  title: string;
  body: string;
} {
  const name = senderUsername.trim() || "Un joueur";
  return {
    type: "MESSAGE_RECEIVED",
    title: NOTIFICATION_TYPE_LABELS.MESSAGE_RECEIVED,
    body: `${name} t'a écrit.`,
  };
}

/**
 * MATCH_FINALIZED — notif in-app après un vrai finalize_match (Edge).
 * Destinataires : membres du club enregistreur + membres du club adverse
 * si opponent_club_id. Le recorder (recorded_by) est exclu : il voit déjà
 * le résultat à l'écran (même doctrine que MESSAGE_RECEIVED / skip self).
 * Pas de notif chat GROUP/CLUB ici.
 */
export function matchFinalizedRecipientIds(input: {
  recordingClubMemberIds: readonly string[];
  opponentClubMemberIds?: readonly string[];
  recorderId: string;
}): string[] {
  const ids = new Set<string>();
  for (const id of input.recordingClubMemberIds) {
    if (id.length > 0) ids.add(id);
  }
  for (const id of input.opponentClubMemberIds ?? []) {
    if (id.length > 0) ids.add(id);
  }
  ids.delete(input.recorderId);
  return [...ids];
}

export function matchFinalizedCopy(input: {
  clubName: string;
  opponentClubName?: string | null;
  ourScore: number;
  opponentScore: number;
}): {
  type: NotificationType;
  title: string;
  body: string;
} {
  const home = input.clubName.trim() || "Ton club";
  const away = input.opponentClubName?.trim() ?? "";
  const score = `${input.ourScore} — ${input.opponentScore}`;
  return {
    type: "MATCH_FINALIZED",
    title: NOTIFICATION_TYPE_LABELS.MATCH_FINALIZED,
    body: away ? `${home} ${score} ${away}.` : `${home} ${score}.`,
  };
}

export function matchFinalizedNotificationData(input: {
  clubId: string;
  matchResultId: string;
  matchCheckinId: string;
  opponentClubId: string | null;
  competitionId: string | null;
  kind?: string | null;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    clubId: input.clubId,
    matchResultId: input.matchResultId,
    matchCheckinId: input.matchCheckinId,
    opponentClubId: input.opponentClubId,
    competitionId: input.competitionId,
  };
  if (input.kind === "TOURNAMENT" || input.kind === "COMPETITION") {
    data.kind = input.kind;
  }
  return data;
}

export type MatchFinalizedNotificationNav = {
  href: string;
  selectClubId: string | null;
  requireClubMode: boolean;
};

function linkedCompetitionStackHref(
  competitionId: string,
  kind: "COMPETITION" | "TOURNAMENT" | null
): string {
  if (kind === "TOURNAMENT") return `/tournaments/${competitionId}`;
  return `/competitions/${competitionId}`;
}

function isCompetitionStackHref(href: string): boolean {
  return (
    href === "/competitions" ||
    href.startsWith("/competitions/") ||
    href === "/tournaments" ||
    href.startsWith("/tournaments/")
  );
}

/**
 * Deep link MATCH_FINALIZED : compétition ou tournoi si competition_id réel
 * (kind TOURNAMENT → `/tournaments/[id]`), sinon `/match` (Mode Club).
 * Jamais `/notifications`.
 */
export function matchFinalizedHref(
  data: Record<string, unknown> | null | undefined,
  _mode: "PLAYER" | "CLUB" = "CLUB"
): string {
  const competitionId = competitionIdFromNotificationData(data);
  if (competitionId) {
    return linkedCompetitionStackHref(competitionId, competitionKindFromNotificationData(data));
  }
  return "/match";
}

export function matchFinalizedNotificationNav(
  type: string,
  data: Record<string, unknown> | null | undefined,
  mode: "PLAYER" | "CLUB" = "CLUB"
): MatchFinalizedNotificationNav | null {
  if (type !== "MATCH_FINALIZED") return null;
  const href = matchFinalizedHref(data, mode);
  if (isCompetitionStackHref(href)) {
    return { href, selectClubId: null, requireClubMode: false };
  }
  return {
    href: "/match",
    selectClubId: clubIdFromNotificationData(data),
    requireClubMode: true,
  };
}

/**
 * COMPETITION_CLUB_REGISTERED — notif in-app après un vrai INSERT
 * competition_clubs (Edge register-competition-club). Destinataires :
 * competitions.created_by (le champ owner n'existe pas) + OWNER/MANAGER
 * du club inscrit. Un user présent des deux côtés = une seule notif.
 * MEMBER du club : pas destinataire. Échec notify ≠ rollback de l'inscription.
 */
export function competitionClubRegisteredRecipientIds(input: {
  createdBy?: string | null;
  clubMembers: readonly { userId: string; role: string }[];
}): string[] {
  const ids = new Set<string>();
  if (input.createdBy && input.createdBy.length > 0) ids.add(input.createdBy);
  for (const member of input.clubMembers) {
    if (!member.userId) continue;
    if (member.role !== "OWNER" && member.role !== "MANAGER") continue;
    ids.add(member.userId);
  }
  return [...ids];
}

export function competitionClubRegisteredCopy(input: {
  clubName: string;
  competitionName: string;
}): {
  type: NotificationType;
  title: string;
  body: string;
} {
  const club = input.clubName.trim() || "Un club";
  const competition = input.competitionName.trim() || "une compétition";
  return {
    type: "COMPETITION_CLUB_REGISTERED",
    title: NOTIFICATION_TYPE_LABELS.COMPETITION_CLUB_REGISTERED,
    body: `${club} s'est inscrit à ${competition}.`,
  };
}

export function competitionClubRegisteredNotificationData(input: {
  clubId: string;
  competitionId: string;
  registrationId: string;
  kind?: string | null;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    clubId: input.clubId,
    competitionId: input.competitionId,
    registrationId: input.registrationId,
  };
  if (input.kind === "TOURNAMENT" || input.kind === "COMPETITION") {
    data.kind = input.kind;
  }
  return data;
}

/** Deep link COMPETITION_CLUB_REGISTERED : tournoi ou compétition si id réel, sinon liste. */
export function competitionClubRegisteredHref(
  data?: Record<string, unknown> | null
): string {
  const competitionId = competitionIdFromNotificationData(data);
  const kind = competitionKindFromNotificationData(data);
  if (!competitionId) return kind === "TOURNAMENT" ? "/tournaments" : "/competitions";
  return linkedCompetitionStackHref(competitionId, kind);
}

/**
 * TOURNAMENT_ROUND_SCHEDULED — notif in-app après INSERT réel
 * tournament_matches (Edge schedule-tournament-round). Destinataires :
 * OWNER/MANAGER de chaque club des NOUVELLES paires, hors acteur.
 * Clubs unpaired : pas destinataires. Échec notify ≠ rollback des matchs.
 */
export function tournamentRoundScheduledClubIds(
  pairings: readonly { clubAId: string; clubBId: string }[]
): string[] {
  const ids = new Set<string>();
  for (const pairing of pairings) {
    if (pairing.clubAId) ids.add(pairing.clubAId);
    if (pairing.clubBId) ids.add(pairing.clubBId);
  }
  return [...ids];
}

export function tournamentRoundScheduledRecipientIds(input: {
  actorId: string;
  clubMembers: readonly { userId: string; role: string }[];
}): string[] {
  const ids = new Set<string>();
  for (const member of input.clubMembers) {
    if (!member.userId || member.userId === input.actorId) continue;
    if (member.role !== "OWNER" && member.role !== "MANAGER") continue;
    ids.add(member.userId);
  }
  return [...ids];
}

export function tournamentRoundScheduledCopy(input: {
  tournamentName: string;
  round: number;
}): {
  type: NotificationType;
  title: string;
  body: string;
} {
  const name = input.tournamentName.trim() || "ce tournoi";
  const round = Number.isInteger(input.round) && input.round >= 1 ? input.round : null;
  return {
    type: "TOURNAMENT_ROUND_SCHEDULED",
    title: NOTIFICATION_TYPE_LABELS.TOURNAMENT_ROUND_SCHEDULED,
    body: round ? `Le tour ${round} de ${name} est programmé.` : `Un tour de ${name} est programmé.`,
  };
}

export function tournamentRoundScheduledNotificationData(input: {
  competitionId: string;
  round: number;
}): Record<string, unknown> {
  return {
    competitionId: input.competitionId,
    kind: "TOURNAMENT",
    round: input.round,
  };
}

/** Deep link TOURNAMENT_ROUND_SCHEDULED : `/tournaments/[id]`, jamais `/notifications`. */
export function tournamentRoundScheduledHref(
  data?: Record<string, unknown> | null
): string {
  const competitionId = competitionIdFromNotificationData(data);
  if (!competitionId) return "/tournaments";
  return `/tournaments/${competitionId}`;
}

export function tournamentRoundScheduledNotificationNav(
  type: string,
  data: Record<string, unknown> | null | undefined,
  _mode: "PLAYER" | "CLUB" = "CLUB"
): MatchFinalizedNotificationNav | null {
  if (type !== "TOURNAMENT_ROUND_SCHEDULED") return null;
  return {
    href: tournamentRoundScheduledHref(data),
    selectClubId: null,
    requireClubMode: false,
  };
}

export function notificationHref(type: string, data: Record<string, unknown> | null | undefined): string {
  const clubId = typeof data?.clubId === "string" ? data.clubId : null;
  switch (type) {
    case "APPLICATION_RECEIVED":
      return clubId ? `/club/${clubId}` : "/my-applications";
    case "APPLICATION_ACCEPTED":
    case "APPLICATION_DECLINED":
      return "/my-applications";
    case "INVITATION_RECEIVED":
      return "/my-invitations";
    case "INVITATION_ACCEPTED":
    case "INVITATION_DECLINED":
      // Recrutement (club manager) — jamais le profil public `/club/[id]`.
      return "/candidatures";
    case "MESSAGE_RECEIVED": {
      const conversationId = conversationIdFromNotificationData(data);
      return conversationId ? `/conversation/${conversationId}` : "/notifications";
    }
    case "MATCH_FINALIZED":
      return matchFinalizedHref(data, "CLUB");
    case "COMPETITION_CLUB_REGISTERED":
      return competitionClubRegisteredHref(data);
    case "TOURNAMENT_ROUND_SCHEDULED":
      return tournamentRoundScheduledHref(data);
    default:
      return "/notifications";
  }
}

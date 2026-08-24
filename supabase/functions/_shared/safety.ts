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
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

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
      return clubId ? `/club/${clubId}` : "/my-invitations";
    default:
      return "/notifications";
  }
}

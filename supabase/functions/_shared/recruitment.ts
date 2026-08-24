/**
 * Transitions de recrutement — source unique, testée.
 * Réexport app : `lib/recruitment.ts`.
 *
 * Candidature (joueur → club) et invitation (club → joueur) : on ne quitte
 * PENDING que vers un état terminal. Toute autre combinaison = no-op
 * (idempotence : rejouer un ACCEPT sur ACCEPTED ne « re-accepte » pas).
 *
 * ApplicationStatus historique : REJECTED reste lisible (lignes pré-P1).
 * Les nouveaux refus club s'écrivent DECLINED (aligné invitations).
 */
export type ApplicationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "RESERVED" | "EXPIRED";

export type RecruitmentEvent = "ACCEPT" | "DECLINE" | "CANCEL" | "EXPIRE" | "WITHDRAW";

export function nextApplicationStatus(
  current: ApplicationStatus,
  event: RecruitmentEvent
): ApplicationStatus | null {
  if (current !== "PENDING") return null;
  switch (event) {
    case "ACCEPT":
      return "ACCEPTED";
    case "DECLINE":
      return "DECLINED";
    case "CANCEL":
      return "CANCELLED";
    case "EXPIRE":
      return "EXPIRED";
    case "WITHDRAW":
      return "WITHDRAWN";
    default:
      return null;
  }
}

export function nextInvitationStatus(
  current: InvitationStatus,
  event: Exclude<RecruitmentEvent, "WITHDRAW">
): InvitationStatus | null {
  if (current !== "PENDING") return null;
  switch (event) {
    case "ACCEPT":
      return "ACCEPTED";
    case "DECLINE":
      return "DECLINED";
    case "CANCEL":
      return "CANCELLED";
    case "EXPIRE":
      return "EXPIRED";
    default:
      return null;
  }
}

/** TTL LIVE écoulé → EXPIRE ; owner passe OFFLINE avant la fin → CANCEL. */
export function liveOffRecruitmentEvent(expiresAt: string | null, nowMs: number): "EXPIRE" | "CANCEL" {
  if (expiresAt && new Date(expiresAt).getTime() <= nowMs) return "EXPIRE";
  return "CANCEL";
}

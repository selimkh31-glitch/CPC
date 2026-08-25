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

export type RecruitmentNotificationNav = {
  href: string;
  /** Club à sélectionner avant d'ouvrir Recrutement (file d'attente de CE club). */
  selectClubId: string | null;
  /** Recrutement vit dans l'arbre Mode Club (`/candidatures`). */
  requireClubMode: boolean;
};

function clubIdFromData(data: Record<string, unknown> | null | undefined): string | null {
  const id = data?.clubId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Cible réelle du tap notification recrutement.
 * APPLICATION_RECEIVED → Recrutement (`/candidatures`) où ApplicationsPanel
 * accepte/refuse — jamais la page publique `/club/[id]` (pas d'actions).
 * INVITATION_ACCEPTED / INVITATION_DECLINED → même Recrutement (destinataire =
 * le manager qui a invité ; ClubInvitationsPanel montre le statut). Pas `/club/[id]`.
 * INVITATION_RECEIVED → `/my-invitations` (bouton Accepter côté joueur).
 */
export function recruitmentNotificationNav(
  type: string,
  data: Record<string, unknown> | null | undefined
): RecruitmentNotificationNav | null {
  switch (type) {
    case "APPLICATION_RECEIVED":
    case "INVITATION_ACCEPTED":
    case "INVITATION_DECLINED":
      return { href: "/candidatures", selectClubId: clubIdFromData(data), requireClubMode: true };
    case "APPLICATION_ACCEPTED":
    case "APPLICATION_DECLINED":
      return { href: "/my-applications", selectClubId: null, requireClubMode: false };
    case "INVITATION_RECEIVED":
      return { href: "/my-invitations", selectClubId: null, requireClubMode: false };
    default:
      return null;
  }
}

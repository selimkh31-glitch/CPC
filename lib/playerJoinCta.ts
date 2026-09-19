/**
 * CTA Rejoindre (Mode Joueur) — visibilité + copy, sans auto-slot.
 *
 * Rejoindre = candidature PENDING. Le manager accepte plus tard.
 * Aligné sur `apply` (Edge) : 1 club MEMBER/MANAGER, Free 3/jour, poste joué ∩ besoin.
 */
import { FREE_APPLICATIONS_PER_DAY } from "./constants";
import { isLiveActive, type LiveSessionLike } from "./live";
import { playerPlaysPosition } from "./liveMatch";
import { uniquePositionCodes } from "./sessionState";
import type { ApplicationStatus, ClubRole, Plan } from "./types";

export const PLAYER_JOIN_COPY = {
  rejoindre: "Rejoindre",
  voir: "Voir",
  pending: "Candidature envoyée — le manager doit accepter.",
  alreadyMember: "Tu es déjà membre de ce club.",
  alreadyInClub: "Tu as déjà un club. Quitte-le avant d'en rejoindre un autre.",
  quota: `Limite Free atteinte (${FREE_APPLICATIONS_PER_DAY}/jour). Passe Pro pour candidater sans limite.`,
  incompatible: "Aucun de tes postes (principal / secondaire) n'est recherché sur ce LIVE.",
  closed: "Ce club n'est plus en LIVE.",
  blocked: "Tu ne peux pas postuler à ce club (blocage).",
  needAuth: "Connecte-toi pour postuler.",
  needProfile: "Termine l'onboarding pour postuler.",
} as const;

export type PlayerJoinKind =
  | "join"
  | "pending"
  | "already_member"
  | "already_in_club"
  | "quota"
  | "incompatible"
  | "closed"
  | "blocked"
  | "need_auth"
  | "need_profile";

export type PlayerJoinCta = {
  kind: PlayerJoinKind;
  showJoin: boolean;
  message: string | null;
};

export type PlayerJoinProfile = {
  mainPosition: string | null | undefined;
  secondaryPositions?: string[] | null;
  plan?: Plan | null;
  applicationsToday?: number | null;
  applicationsResetAt?: string | null;
};

export type PlayerJoinMembership = {
  clubId: string;
  role: ClubRole;
};

export type PlayerJoinApplication = {
  sessionId: string;
  clubId?: string | null;
  status: ApplicationStatus;
};

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function freeApplicationsUsedToday(
  profile: Pick<PlayerJoinProfile, "plan" | "applicationsToday" | "applicationsResetAt"> | null | undefined,
  nowMs: number
): number {
  if (!profile || profile.plan !== "FREE") return 0;
  const resetAt = profile.applicationsResetAt;
  if (!resetAt) return profile.applicationsToday ?? 0;
  const resetNeeded = !isSameDay(new Date(resetAt), new Date(nowMs));
  return resetNeeded ? 0 : profile.applicationsToday ?? 0;
}

export function playableNeededPositions(
  profile: Pick<PlayerJoinProfile, "mainPosition" | "secondaryPositions"> | null | undefined,
  neededPositions: readonly string[] | null | undefined
): string[] {
  if (!profile?.mainPosition) return [];
  const player = {
    mainPosition: profile.mainPosition,
    secondaryPositions: profile.secondaryPositions ?? [],
    platform: "",
  };
  return uniquePositionCodes(neededPositions).filter((p) => playerPlaysPosition(player, p));
}

export function resolvePlayerJoinCta(input: {
  signedIn: boolean;
  profile: PlayerJoinProfile | null | undefined;
  session: (LiveSessionLike & { id?: string }) | null | undefined;
  neededPositions?: readonly string[] | null;
  nowMs: number;
  thisClubId: string | null | undefined;
  memberships?: readonly PlayerJoinMembership[] | null;
  applications?: readonly PlayerJoinApplication[] | null;
  blocked?: boolean;
}): PlayerJoinCta {
  if (!input.signedIn) {
    return { kind: "need_auth", showJoin: false, message: PLAYER_JOIN_COPY.needAuth };
  }
  if (!input.profile?.mainPosition) {
    return { kind: "need_profile", showJoin: false, message: PLAYER_JOIN_COPY.needProfile };
  }
  if (!input.session || !isLiveActive(input.session, input.nowMs)) {
    return { kind: "closed", showJoin: false, message: PLAYER_JOIN_COPY.closed };
  }
  if (input.blocked) {
    return { kind: "blocked", showJoin: false, message: PLAYER_JOIN_COPY.blocked };
  }

  const clubId = input.thisClubId?.trim() ?? "";
  const memberships = input.memberships ?? [];
  const thisMembership = clubId ? memberships.find((m) => m.clubId === clubId) : undefined;
  if (thisMembership) {
    return { kind: "already_member", showJoin: false, message: PLAYER_JOIN_COPY.alreadyMember };
  }

  const elsewhere = memberships.some(
    (m) => m.clubId !== clubId && (m.role === "MEMBER" || m.role === "MANAGER")
  );
  if (elsewhere) {
    return { kind: "already_in_club", showJoin: false, message: PLAYER_JOIN_COPY.alreadyInClub };
  }

  const sessionId = input.session.id;
  const pending = (input.applications ?? []).some(
    (a) =>
      a.status === "PENDING" &&
      ((sessionId && a.sessionId === sessionId) || (clubId && a.clubId === clubId))
  );
  if (pending) {
    return { kind: "pending", showJoin: false, message: PLAYER_JOIN_COPY.pending };
  }

  if (input.profile.plan === "FREE") {
    const used = freeApplicationsUsedToday(input.profile, input.nowMs);
    if (used >= FREE_APPLICATIONS_PER_DAY) {
      return { kind: "quota", showJoin: false, message: PLAYER_JOIN_COPY.quota };
    }
  }

  const playable = playableNeededPositions(input.profile, input.neededPositions);
  if (playable.length === 0) {
    return { kind: "incompatible", showJoin: false, message: PLAYER_JOIN_COPY.incompatible };
  }

  return { kind: "join", showJoin: true, message: null };
}

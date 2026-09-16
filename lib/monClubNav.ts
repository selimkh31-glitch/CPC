import type { ClubRole, ClubRow } from "@/lib/types";

export type MembershipLike = { role: ClubRole; club: ClubRow };

/**
 * Découpe les adhésions pour Accueil / menu « Mon club ».
 * OWNER/MANAGER d'abord, sinon MEMBER, sinon rien — jamais un club inventé.
 */
export function splitMemberships(memberships: MembershipLike[] | null | undefined): {
  managed: MembershipLike[];
  member: MembershipLike | undefined;
  anyClub: MembershipLike | null;
} {
  const list = memberships ?? [];
  const managed = list.filter((m) => (m.role === "OWNER" || m.role === "MANAGER") && m.club?.id);
  const member = list.find((m) => m.role === "MEMBER" && m.club?.id) ?? list.find((m) => m.club?.id);
  return { managed, member, anyClub: managed[0] ?? member ?? null };
}

export const PLAYER_MATCHMAKING_HREF = "/(player)/(tabs)/";
export const CLUB_MATCHMAKING_HREF = "/(club)/(tabs)/";
export const CLUB_RECRUTEMENT_HREF = "/(club)/(tabs)/candidatures";

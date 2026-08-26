/**
 * Dérivation d'identité club à partir des champs déjà persistés.
 * Jamais de plateforme / LIVE / niveau inventés : si le owner n'est pas
 * hydraté ou si aucune session n'est réellement LIVE, on renvoie null/false.
 */
import { CLUB_LEVEL_LABELS, LANGUAGE_LABELS, PLATFORM_LABELS } from "@/lib/constants";
import { findActiveLiveSession, type LiveSessionLike } from "@/lib/live";
import type { ClubLevel, ClubMemberRow, Platform } from "@/lib/types";

export function findClubOwner(members: ClubMemberRow[] | null | undefined): ClubMemberRow | undefined {
  return members?.find((m) => m.role === "OWNER");
}

/** Plateforme du owner — uniquement si `user.platform` est réellement chargé. */
export function clubOwnerPlatform(members: ClubMemberRow[] | null | undefined): Platform | null {
  return findClubOwner(members)?.user?.platform ?? null;
}

export function clubOwnerUsername(members: ClubMemberRow[] | null | undefined): string | null {
  return findClubOwner(members)?.user?.username ?? null;
}

export function clubIdentityLine(input: { level: ClubLevel; ownerPlatform: Platform | null }): string {
  const parts = [CLUB_LEVEL_LABELS[input.level] ?? input.level];
  if (input.ownerPlatform) parts.push(PLATFORM_LABELS[input.ownerPlatform]);
  return parts.join(" · ");
}

export function clubLanguagesLine(languages: string[] | null | undefined): string | null {
  if (!languages?.length) return null;
  return languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ");
}

export function clubActiveLiveSession<T extends LiveSessionLike>(
  sessions: T[] | null | undefined,
  nowMs: number
): T | null {
  return findActiveLiveSession(sessions, nowMs);
}

/**
 * Page publique d'un club (`/club/[id]`) — Rejoindre le club (LIVE) + membres.
 * Distinct de `/match-sheet` (feuille joueur, prise de poste après membership)
 * et de `/match` (feuille owner/manager, Mode Club).
 */
export function clubPublicHref(clubId: string, sessionId?: string | null): string {
  const id = clubId.trim();
  const base = `/club/${id}`;
  const session = sessionId?.trim();
  return session ? `${base}?session=${encodeURIComponent(session)}` : base;
}

/** Tri d'affichage uniquement — ne change aucun rôle en base. */
export function sortClubRoster(members: ClubMemberRow[]): ClubMemberRow[] {
  const order: Record<ClubMemberRow["role"], number> = { OWNER: 0, MANAGER: 1, MEMBER: 2 };
  return [...members].sort((a, b) => {
    const byRole = order[a.role] - order[b.role];
    if (byRole !== 0) return byRole;
    return a.joined_at.localeCompare(b.joined_at);
  });
}

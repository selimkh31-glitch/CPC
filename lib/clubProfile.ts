/**
 * Dérivation d'identité club à partir des champs déjà persistés.
 * Jamais de plateforme / LIVE / niveau inventés : si le owner n'est pas
 * hydraté ou si aucune session n'est réellement LIVE, on renvoie null/false.
 */
import { CLUB_LEVEL_LABELS, LANGUAGE_LABELS, PLATFORM_LABELS } from "@/lib/constants";
import { findActiveLiveSession, isLiveActive, type LiveSessionLike } from "@/lib/live";
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
 * Page publique d'un club (`/club/[id]`) — ApplyForm + membres.
 * Distinct de `/match-sheet` (vue joueur de la formation, interactive=false,
 * pas de candidature) et de `/match` (feuille owner/manager, Mode Club).
 */
export function clubPublicHref(
  clubId: string,
  sessionId?: string | null,
  opts?: { join?: boolean }
): string {
  const id = clubId.trim();
  const base = `/club/${id}`;
  const params = new URLSearchParams();
  const session = sessionId?.trim();
  if (session) params.set("session", session);
  if (opts?.join) params.set("join", "1");
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

/** Session du query `?session=` si encore LIVE, sinon première session active. */
export function resolveClubPreviewSession<T extends LiveSessionLike & { id?: string }>(
  sessions: T[] | null | undefined,
  nowMs: number,
  preferredSessionId?: string | null
): T | null {
  const preferred = preferredSessionId?.trim();
  if (preferred) {
    const match = sessions?.find((s) => s.id === preferred);
    if (match && isLiveActive(match, nowMs)) return match;
  }
  return findActiveLiveSession(sessions, nowMs);
}

/** Tri d'affichage uniquement — ne change aucun rôle en base. */
export function sortClubRoster(members: ClubMemberRow[]): ClubMemberRow[] {
  const order: Record<ClubMemberRow["role"], number> = { OWNER: 0, MANAGER: 1, MEMBER: 2 };
  return [...members].sort((a, b) => {
    const byRole = (order[a.role] ?? 9) - (order[b.role] ?? 9);
    if (byRole !== 0) return byRole;
    return (a.joined_at ?? "").localeCompare(b.joined_at ?? "");
  });
}

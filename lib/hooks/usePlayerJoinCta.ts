import { resolvePlayerJoinCta, type PlayerJoinCta } from "@/lib/playerJoinCta";
import { useMyApplications } from "@/lib/hooks/useApplications";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useAuth } from "@/lib/providers/AuthProvider";
import type { LiveSessionLike } from "@/lib/live";

/** Agrège profil, clubs et candidatures pour le CTA Rejoindre (Mode Joueur). */
export function usePlayerJoinCta(input: {
  clubId: string | null | undefined;
  session: (LiveSessionLike & { id?: string }) | null | undefined;
  neededPositions?: readonly string[] | null;
  blocked?: boolean;
}): PlayerJoinCta {
  const { session: auth, profile } = useAuth();
  const userId = auth?.user.id ?? null;
  const { data: memberships } = useMyMemberships(userId);
  const { data: applications } = useMyApplications(userId);
  const nowMs = useLiveClock();

  return resolvePlayerJoinCta({
    signedIn: Boolean(auth),
    profile: profile
      ? {
          mainPosition: profile.main_position,
          secondaryPositions: profile.secondary_positions,
          plan: profile.plan,
          applicationsToday: profile.applications_today,
          applicationsResetAt: profile.applications_reset_at,
        }
      : null,
    session: input.session,
    neededPositions: input.neededPositions,
    nowMs,
    thisClubId: input.clubId,
    memberships: (memberships ?? []).map((m) => ({ clubId: m.club.id, role: m.role })),
    applications: (applications ?? []).map((a) => ({
      sessionId: a.session_id,
      clubId: a.club_id,
      status: a.status,
    })),
    blocked: Boolean(input.blocked),
  });
}

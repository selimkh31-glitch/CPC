import { useCallback } from "react";
import { router, type Href } from "expo-router";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { playerInvitationAcceptHref } from "@/lib/recruitment";
import { clubPublicHref } from "@/lib/clubProfile";
import { CLUB_MATCH_SHEET_HREF } from "@/lib/live";
import { splitMemberships } from "@/lib/monClubNav";

/**
 * « Mon club » est joueur-only (aperçu / feuille membre). Pas de setMode ici —
 * Joueur ↔ Club = petite bascule du menu (switchMode + overlay).
 * PLAYER membre → feuille joueur. PLAYER owner/manager → aperçu `/club/[id]`.
 */
export function useOpenMonClub() {
  const { session } = useAuth();
  const { mode, setSelectedManagedClubId } = useAppMode();
  const { data: memberships, isLoading } = useMyMemberships(session?.user.id ?? null);
  const split = splitMemberships(memberships);

  const openMonClub = useCallback(() => {
    const { managed, member, anyClub } = splitMemberships(memberships);
    if (mode === "CLUB") {
      if (managed.length === 1) setSelectedManagedClubId(managed[0].club.id);
      if (managed.length > 0) {
        router.push(CLUB_MATCH_SHEET_HREF as Href);
        return;
      }
      router.push("/(club)/(tabs)/home" as Href);
      return;
    }
    if (managed.length === 0 && member?.club?.id) {
      const href = playerInvitationAcceptHref(member.club.id);
      if (href) router.push(href as Href);
      return;
    }
    if (anyClub?.club?.id) {
      router.push(clubPublicHref(anyClub.club.id) as Href);
      return;
    }
    router.push("/clubs");
  }, [memberships, mode, setSelectedManagedClubId]);

  return { openMonClub, memberships, isLoading, ...split };
}

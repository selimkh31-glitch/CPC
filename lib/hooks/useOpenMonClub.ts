import { useCallback } from "react";
import { InteractionManager } from "react-native";
import { router, type Href } from "expo-router";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { playerInvitationAcceptHref } from "@/lib/recruitment";
import { CLUB_MATCH_SHEET_HREF } from "@/lib/live";
import { splitMemberships } from "@/lib/monClubNav";

/**
 * Même destination que le menu « Mon club » :
 * OWNER/MANAGER → feuille Match (`/match`) ; MEMBER → ClubHome ; aucun → /clubs.
 */
export function useOpenMonClub() {
  const { session } = useAuth();
  const { mode, setMode, setSelectedManagedClubId } = useAppMode();
  const { data: memberships, isLoading } = useMyMemberships(session?.user.id ?? null);
  const split = splitMemberships(memberships);

  const openMonClub = useCallback(() => {
    const { managed, member } = splitMemberships(memberships);
    if (managed.length > 0) {
      if (managed.length === 1) setSelectedManagedClubId(managed[0].club.id);
      const goFeuille = () => router.push(CLUB_MATCH_SHEET_HREF as Href);
      if (mode !== "CLUB") {
        setMode("CLUB");
        InteractionManager.runAfterInteractions(goFeuille);
        return;
      }
      goFeuille();
      return;
    }
    if (member?.club?.id) {
      const href = playerInvitationAcceptHref(member.club.id);
      if (href) router.push(href as Href);
      return;
    }
    router.push("/clubs");
  }, [memberships, mode, setMode, setSelectedManagedClubId]);

  return { openMonClub, memberships, isLoading, ...split };
}

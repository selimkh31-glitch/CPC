import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useClub } from "@/lib/hooks/useClubs";

/**
 * Foundation #1 — club actuellement géré en Mode Club, dérivé de
 * `selectedManagedClubId` (AppModeProvider). Déjà revalidé contre les
 * memberships réels par app/(club)/_layout.tsx avant que les tabs Mode Club
 * (LIVE / Recrutement / Club) ne soient montées — ce hook
 * ne revalide rien lui-même, il évite juste de relire le contexte + appeler
 * useClub séparément dans chacun des onglets Mode Club.
 */
export function useManagedClub() {
  const { selectedManagedClubId } = useAppMode();
  return useClub(selectedManagedClubId);
}

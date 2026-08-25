import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useClub } from "@/lib/hooks/useClubs";

/**
 * Foundation #1 — club actuellement géré en Mode Club, dérivé de
 * `selectedManagedClubId` (AppModeProvider). Déjà revalidé contre les
 * memberships réels par app/(club)/_layout.tsx (id stale vidé si plus
 * aucun club géré). Un club disparu (PGRST116) revient `null`, pas une erreur.
 */
export function useManagedClub() {
  const { selectedManagedClubId } = useAppMode();
  return useClub(selectedManagedClubId);
}

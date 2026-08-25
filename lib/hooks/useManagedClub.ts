import { useCallback } from "react";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useClub } from "@/lib/hooks/useClubs";

/**
 * Club géré en Mode Club. Sans id : refetch est un no-op (TanStack refetch
 * ignore `enabled: false` et enverrait `id=null` à PostgREST).
 */
export function useManagedClub() {
  const { selectedManagedClubId } = useAppMode();
  const query = useClub(selectedManagedClubId);
  const refetchQuery = query.refetch;
  const refetch = useCallback(() => {
    if (!selectedManagedClubId) return Promise.resolve();
    return refetchQuery();
  }, [selectedManagedClubId, refetchQuery]);

  return { ...query, clubId: selectedManagedClubId, refetch };
}

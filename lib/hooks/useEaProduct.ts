import { useQuery } from "@tanstack/react-query";
import { callEdgeFunction } from "@/lib/api/edge";
import {
  EA_PRODUCT_HISTORY_QUERY_KEY,
  type EaProductHistoryResult,
} from "@/lib/eaProduct";

export function eaProductHistoryQueryKey(eaClubId: string, playername?: string | null) {
  return [EA_PRODUCT_HISTORY_QUERY_KEY, eaClubId, playername?.trim() || ""] as const;
}

/**
 * Ledger produit fc27 : club / effectif / matchs / joueur optionnel.
 * Listes vides honnêtes tant que l'ingest live n'est pas fc27.
 * Ne change pas les écrans — bind UX plus tard.
 */
export function useEaProductHistory(eaClubId: string | null, playername?: string | null) {
  const clubId = eaClubId?.trim() || "";
  const name = playername?.trim() || "";
  return useQuery({
    queryKey: eaProductHistoryQueryKey(clubId, name),
    enabled: Boolean(clubId),
    queryFn: () =>
      callEdgeFunction<EaProductHistoryResult>("link-ea-club", {
        action: "history",
        eaClubId: clubId,
        ...(name ? { playername: name } : {}),
      }),
  });
}

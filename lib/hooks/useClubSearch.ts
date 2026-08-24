import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { FORMATIONS, type FormationId, type FormationSlot } from "@/lib/formations";
import type { ClubRow } from "@/lib/types";
import type { PositionCode } from "@/lib/constants";

export interface ClubMatch {
  club: ClubRow & { owner?: { username: string } | null; sessions?: { is_live: boolean; expires_at: string | null }[] };
  formationId: FormationId;
  openSlots: FormationSlot[];
}

/**
 * Joueur -> club (phase 4). Une seule requête groupée (clubs + leurs
 * slot_assignments, pas une requête par club) ; le calcul des slots vides
 * compatibles se fait ensuite côté client à partir de lib/formations.ts —
 * jamais une deuxième source de vérité en base.
 */
export function useClubSearch(mainPosition: PositionCode | null, secondaryPositions: PositionCode[]) {
  return useQuery({
    queryKey: ["club-search", mainPosition, secondaryPositions.slice().sort().join(",")],
    enabled: Boolean(mainPosition),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("*, slotAssignments:slot_assignments(slot_id), owner:users(username), sessions:club_sessions(is_live,expires_at)")
        .not("formation", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;

      const wanted = new Set<string>([mainPosition!, ...secondaryPositions]);
      const results: ClubMatch[] = [];

      for (const row of data as (ClubRow & {
        slotAssignments: { slot_id: string }[];
        owner: { username: string } | null;
        sessions: { is_live: boolean; expires_at: string | null }[];
      })[]) {
        const formationId = row.formation as FormationId | null;
        if (!formationId || !FORMATIONS[formationId]) continue;

        const occupied = new Set(row.slotAssignments.map((a) => a.slot_id));
        const openSlots = FORMATIONS[formationId].filter(
          (slot) => !occupied.has(slot.slotId) && wanted.has(slot.position)
        );
        if (openSlots.length > 0) {
          results.push({ club: row, formationId, openSlots });
        }
      }

      return results;
    },
  });
}

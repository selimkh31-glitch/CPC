import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { excludeFullyEngagedElsewhere } from "@/lib/playerSearchFilters";
import { USER_PUBLIC_COLUMNS, type UserRow } from "@/lib/types";
import type { PositionCode } from "@/lib/constants";

/**
 * Club -> joueur (phase 4). Une seule requête filtrée (pas une par joueur,
 * voir contrainte perf) : position principale OU secondaire = position du
 * slot, triés principale d'abord. Aucun scoring/IA — uniquement les colonnes
 * réellement présentes sur `users`.
 *
 * M2 — n'affiche pas des candidats qu'`invite-to-slot` (Edge Function,
 * inchangée) rejettera de toute façon avec `already_has_active_club` : une
 * seconde requête, scopée aux seuls candidats déjà retournés (pas un scan de
 * toute la table), lit leur éventuel membership actif MEMBER/MANAGER
 * (`club_members`, lecture non restreinte par RLS) ; la décision d'exclusion
 * elle-même vit dans lib/playerSearchFilters.ts (logique pure, testée en
 * isolation). needed_positions n'intervient à aucun moment ici.
 */
export function usePlayerSearch(position: PositionCode | null, excludeUserIds: string[]) {
  return useQuery({
    queryKey: ["player-search", position, excludeUserIds.slice().sort().join(",")],
    enabled: Boolean(position),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select(USER_PUBLIC_COLUMNS)
        .or(`main_position.eq.${position},secondary_positions.cs.{${position}}`)
        .order("reliability_score", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = (data as unknown as UserRow[]).filter((u) => !excludeUserIds.includes(u.id));

      let filtered = rows;
      if (rows.length > 0) {
        const { data: activeMemberships, error: membershipsError } = await supabase
          .from("club_members")
          .select("user_id, active_departure_request_id")
          .in(
            "user_id",
            rows.map((u) => u.id)
          )
          .in("role", ["MEMBER", "MANAGER"]);
        if (membershipsError) throw membershipsError;
        filtered = excludeFullyEngagedElsewhere(rows, activeMemberships ?? []);
      }

      // Priorité 1 : position principale exacte. Priorité 2 : position secondaire.
      return filtered.sort((a, b) => {
        const aPrimary = a.main_position === position ? 0 : 1;
        const bPrimary = b.main_position === position ? 0 : 1;
        return aPrimary - bPrimary;
      });
    },
  });
}

/**
 * Effectif -> invitation CLUB générale (pas de slot/poste visé) — distinct de
 * `usePlayerSearch` ci-dessus (recrutement pour un slot précis, réservé au
 * flux MATCH d'`app/player-search.tsx`, jamais touché ici) : recherche par
 * pseudo, sans filtre de position. Même garde "déjà engagé ailleurs" que
 * `usePlayerSearch` (`excludeFullyEngagedElsewhere`) et même raison :
 * `invite-to-club` (Edge Function) rejette de toute façon ces candidats,
 * l'exclure ici n'est qu'une optimisation UX, jamais la seule garde.
 */
export function useInvitableClubPlayers(query: string, excludeUserIds: string[]) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["invitable-club-players", trimmed, excludeUserIds.slice().sort().join(",")],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select(USER_PUBLIC_COLUMNS)
        .ilike("username", `%${trimmed}%`)
        .order("reliability_score", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = (data as unknown as UserRow[]).filter((u) => !excludeUserIds.includes(u.id));

      if (rows.length === 0) return rows;

      const { data: activeMemberships, error: membershipsError } = await supabase
        .from("club_members")
        .select("user_id, active_departure_request_id")
        .in(
          "user_id",
          rows.map((u) => u.id)
        )
        .in("role", ["MEMBER", "MANAGER"]);
      if (membershipsError) throw membershipsError;
      return excludeFullyEngagedElsewhere(rows, activeMemberships ?? []);
    },
  });
}

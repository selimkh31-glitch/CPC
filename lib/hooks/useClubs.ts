import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { computeLiveExpiresAt, parseLiveDurationMs } from "@/lib/live";
import { validateClubIdentity } from "@/lib/clubIdentity";
import { filterClubsHiddenByBlock } from "@/lib/safety";
import { USER_PUBLIC_COLUMNS, type ClubMemberRow, type ClubRole, type ClubRow, type ClubSessionRow, type SlotAssignmentRow } from "@/lib/types";
import { fetchBlockedUserIdSet } from "@/lib/hooks/useSafety";
import { clubReadOrNull } from "@/lib/clubRead";

export function useClubsList() {
  return useQuery({
    queryKey: ["clubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("*, sessions:club_sessions(is_live, expires_at)")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      let blocked: Set<string>;
      try {
        blocked = await fetchBlockedUserIdSet();
      } catch {
        blocked = new Set();
      }
      const rows = data as (ClubRow & { sessions: { is_live: boolean; expires_at: string | null }[] })[];
      return filterClubsHiddenByBlock(rows, blocked);
    },
  });
}

export function useClub(clubId: string | null) {
  return useQuery({
    queryKey: ["club", clubId],
    enabled: Boolean(clubId),
    queryFn: async () => {
      if (!clubId) return null;
      const { data, error } = await supabase
        .from("clubs")
        .select(
          `*, members:club_members(*, user:users(${USER_PUBLIC_COLUMNS})), sessions:club_sessions(*), slotAssignments:slot_assignments(*, user:users(${USER_PUBLIC_COLUMNS}))`
        )
        .eq("id", clubId)
        .maybeSingle();
      return clubReadOrNull({ data, error }) as
        | (ClubRow & { members: ClubMemberRow[]; sessions: ClubSessionRow[]; slotAssignments: SlotAssignmentRow[] })
        | null;
    },
  });
}

/** Clubs gérés par le user connecté (owner ou manager) — alimente le dashboard. */
export function useMyClubs(userId: string | null) {
  return useQuery({
    queryKey: ["my-clubs", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_members")
        .select("role, club:clubs(*, sessions:club_sessions(*))")
        .eq("user_id", userId!)
        .in("role", ["OWNER", "MANAGER"]);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.club as ClubRow & { sessions: ClubSessionRow[] });
    },
  });
}

/**
 * Toutes les adhésions club du user connecté, tout rôle confondu (OWNER,
 * MANAGER, MEMBER) — alimente la section "Mes clubs" du profil (contexte
 * joueur + gestionnaire, voir Phase 4.5). Distinct de useMyClubs (filtré
 * OWNER/MANAGER, pour le dashboard de gestion).
 */
export function useMyMemberships(userId: string | null) {
  return useQuery({
    queryKey: ["my-memberships", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_members")
        .select("role, club:clubs(*)")
        .eq("user_id", userId!)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as { role: ClubRole; club: ClubRow }[];
    },
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; level: string; languages: string[]; description?: string; ownerId: string }) => {
      // Un seul INSERT : le trigger Postgres `on_club_created`
      // (supabase/migrations/0003_triggers.sql) crée le club_members OWNER
      // dans la même transaction — plus de risque de club orphelin si un 2e
      // appel réseau échouait ici.
      const { data: club, error } = await supabase
        .from("clubs")
        .insert({
          name: input.name,
          level: input.level,
          languages: input.languages,
          description: input.description ?? null,
          owner_id: input.ownerId,
        })
        .select()
        .single();
      if (error) throw error;

      return club as ClubRow;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["clubs"] });
    },
  });
}

/**
 * Mise à jour de l'identité du club via RLS `clubs_update_owner`.
 * Le payload passe par l'allowlist : owner_id, formation, ea_club_id et
 * une plateforme inventée ne sont jamais envoyés.
 */
export function useUpdateClub(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const validated = validateClubIdentity(input);
      if (!validated.ok) throw new Error(validated.message);
      const { data, error } = await supabase
        .from("clubs")
        .update(validated.patch)
        .eq("id", clubId)
        .select()
        .single();
      if (error) throw error;
      return data as ClubRow;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      queryClient.invalidateQueries({ queryKey: ["clubs"] });
    },
  });
}

export function useCreateSession(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { neededPositions: string[]; note?: string; durationMs?: number }) => {
      if (!input.neededPositions.length) throw new Error("Sélectionne au moins un poste recherché.");
      const durationMs = parseLiveDurationMs(input.durationMs !== undefined ? String(input.durationMs) : undefined);
      const expiresAt = computeLiveExpiresAt(Date.now(), durationMs).toISOString();
      await supabase.from("club_sessions").update({ is_live: false }).eq("club_id", clubId).eq("is_live", true);
      const { data, error } = await supabase
        .from("club_sessions")
        .insert({
          club_id: clubId,
          is_live: true,
          needed_positions: input.neededPositions,
          note: input.note ?? null,
          expires_at: expiresAt,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ClubSessionRow;
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
    },
  });
}

export function useToggleSession(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; isLive: boolean; durationMs?: number }) => {
      const goingLive = !input.isLive;
      const patch: { is_live: boolean; expires_at?: string } = { is_live: goingLive };
      if (goingLive) {
        const durationMs = parseLiveDurationMs(input.durationMs !== undefined ? String(input.durationMs) : undefined);
        patch.expires_at = computeLiveExpiresAt(Date.now(), durationMs).toISOString();
      }
      const { error } = await supabase.from("club_sessions").update(patch).eq("id", input.sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
    },
  });
}

/**
 * Changement de formation (feuille de match, phase 3). Ne supprime JAMAIS
 * club_members — uniquement les slot_assignments de ce club, puisqu'un
 * slotId n'a de sens que pour la formation qui l'a défini (lib/formations.ts).
 * Les membres restent dans le club, à réassigner explicitement ensuite
 * (comportement V1 volontairement simple, voir architecture validée).
 */
export function useUpdateFormation(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formation: string) => {
      const { error: unassignError } = await supabase.from("slot_assignments").delete().eq("club_id", clubId);
      if (unassignError) throw unassignError;

      const { data, error } = await supabase.from("clubs").update({ formation }).eq("id", clubId).select().single();
      if (error) throw error;
      return data as ClubRow;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
    },
  });
}

/**
 * Promotion/rétrogradation MEMBER<->MANAGER — écriture directe légitime (RLS
 * club_members_write_owner, colonne `role` non protégée). La suppression d'un
 * membre ne passe PLUS par ce hook depuis la Phase 5 : voir useReleaseMember
 * (lib/hooks/useDepartures.ts), qui appelle release-member (Edge Function) —
 * seule façon autorisée de retirer un membre (supprime aussi slot_assignments
 * côté serveur, historise l'événement, notifie le joueur).
 */
export function useUpdateMember(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; role: "MANAGER" | "MEMBER" }) => {
      const { error } = await supabase
        .from("club_members")
        .update({ role: input.role })
        .eq("club_id", clubId)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["my-clubs"] });
    },
  });
}

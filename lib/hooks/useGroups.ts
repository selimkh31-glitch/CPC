import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { USER_PUBLIC_COLUMNS, type GroupMemberRow, type GroupRow } from "@/lib/types";

/**
 * Groupes sociaux — fondation (mission "GROUPES SOCIAUX", section 12).
 * Backend + RLS + hooks livrés cette session ; AUCUN écran ne les consomme
 * encore (voir rapport, section "Groups" — "Groupes, phase 2 : écrans").
 * Toute écriture "simple" (créer, rejoindre, quitter) passe par un appel
 * client direct, protégé par RLS (supabase/migrations/0017_group_rls.sql) —
 * même convention que club_sessions/reviews. Le changement de rôle d'un
 * membre (promotion ADMIN) n'a PAS de hook ici : il n'existe aucune Edge
 * Function branchée sur set_group_member_role() cette session (READY FOR
 * PROVIDER, fonction SQL prête, service_role uniquement).
 */

/** Groupes dont l'utilisateur connecté est déjà membre. */
export function useMyGroups(userId: string | null) {
  return useQuery({
    queryKey: ["my-groups", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: memberships, error: membershipsError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId!);
      if (membershipsError) throw membershipsError;

      const groupIds = (memberships ?? []).map((m) => m.group_id);
      if (groupIds.length === 0) return [] as GroupRow[];

      const { data, error } = await supabase.from("groups").select("*").in("id", groupIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data as GroupRow[];
    },
  });
}

/** Annuaire des groupes PUBLIC (découverte/rejoindre — RLS `groups_select_visible`). */
export function usePublicGroups() {
  return useQuery({
    queryKey: ["public-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("visibility", "PUBLIC")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GroupRow[];
    },
  });
}

export function useGroup(groupId: string | null) {
  return useQuery({
    queryKey: ["group", groupId],
    enabled: Boolean(groupId),
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").eq("id", groupId!).single();
      if (error) throw error;
      return data as GroupRow;
    },
  });
}

/** Membres d'un groupe — RLS exige déjà d'en être membre soi-même. */
export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ["group-members", groupId],
    enabled: Boolean(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select(`*, user:users(${USER_PUBLIC_COLUMNS})`)
        .eq("group_id", groupId!)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data as GroupMemberRow[];
    },
  });
}

/** Crée un groupe — le trigger on_group_created ajoute atomiquement le owner comme membre + provisionne sa conversation. */
export function useCreateGroup(ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; visibility: "PUBLIC" | "PRIVATE" }) => {
      const { data, error } = await supabase
        .from("groups")
        .insert({ name: input.name, description: input.description ?? null, visibility: input.visibility, owner_id: ownerId })
        .select("*")
        .single();
      if (error) throw error;
      return data as GroupRow;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-groups", ownerId] });
      queryClient.invalidateQueries({ queryKey: ["public-groups"] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

/** Rejoindre un groupe PUBLIC (RLS `group_members_join_public` refuse tout le reste — role forcé à MEMBER). */
export function useJoinGroup(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId, role: "MEMBER" });
      if (error) throw error;
    },
    onSuccess: (_data, groupId) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

/** Quitter un groupe (RLS `group_members_leave_self` — sa propre ligne uniquement). */
export function useLeaveGroup(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_data, groupId) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

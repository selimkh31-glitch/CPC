import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import { USER_PUBLIC_COLUMNS, type GroupMemberRow, type GroupRole, type GroupRow } from "@/lib/types";

/**
 * Groupes sociaux — fondation + UI (mission "GROUPES SOCIAUX", section 12).
 * Toute écriture "simple" (créer, rejoindre, quitter, supprimer) passe par
 * un appel client direct, protégé par RLS (supabase/migrations/0018_group_rls.sql)
 * — même convention que club_sessions/reviews. Le changement de rôle passe
 * par l'Edge Function set-group-member-role (multi-étapes/sensible :
 * vérification OWNER + interdiction du rôle OWNER côté serveur), jamais un
 * UPDATE direct — RLS n'expose d'ailleurs aucune policy UPDATE sur
 * group_members pour authenticated.
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

/**
 * Quitter un groupe (RLS `group_members_leave_self`). Bloqué en base pour le
 * OWNER (voir migration) — l'appelant doit filtrer ce cas côté UI (bouton
 * masqué/désactivé) plutôt que de laisser l'erreur serveur être la seule
 * ligne de défense, mais RLS reste la garantie réelle.
 */
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

/** Supprime un groupe (RLS `groups_delete_owner` — owner uniquement). Cascade DB sur membres/conversation/messages. */
export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: (_data, groupId) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      queryClient.invalidateQueries({ queryKey: ["public-groups"] });
      queryClient.removeQueries({ queryKey: ["group", groupId] });
      queryClient.removeQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

/**
 * Change le rôle d'un membre (ADMIN <-> MEMBER uniquement, jamais OWNER —
 * voir set-group-member-role/index.ts). Le OWNER appelant est vérifié côté
 * serveur (SQL + Edge Function), pas seulement en désactivant le bouton ici.
 */
export function useSetGroupMemberRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { targetUserId: string; newRole: Extract<GroupRole, "ADMIN" | "MEMBER"> }) =>
      callEdgeFunction("set-group-member-role", { groupId, targetUserId: vars.targetUserId, newRole: vars.newRole }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

/**
 * Id de la conversation GROUP associée (provisionnée par le trigger
 * on_group_created + tenue à jour par sync_group_conversation_membership,
 * voir 0018_group_rls.sql). `null` tant qu'on n'est pas encore membre — RLS
 * `conversations_select_member` (0017_chat_rls.sql) filtre déjà, cette
 * requête ne peut donc jamais renvoyer la conversation d'un groupe dont
 * l'utilisateur n'est pas membre.
 */
export function useGroupConversationId(groupId: string | null) {
  return useQuery({
    queryKey: ["group-conversation", groupId],
    enabled: Boolean(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id")
        .eq("group_id", groupId!)
        .eq("type", "GROUP")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });
}

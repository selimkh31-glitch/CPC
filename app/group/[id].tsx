import { useMemo } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Crown, LogOut, MessageCircle, Shield, Trash2 } from "lucide-react-native";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayerCard } from "@/components/player/PlayerCard";
import { buildPlayerCardData } from "@/lib/playerCard";
import { useAuth } from "@/lib/providers/AuthProvider";
import {
  useDeleteGroup,
  useGroup,
  useGroupConversationId,
  useGroupMembers,
  useJoinGroup,
  useLeaveGroup,
  useSetGroupMemberRole,
} from "@/lib/hooks/useGroups";
import { toast } from "@/lib/toast";
import type { GroupMemberRow } from "@/lib/types";

/**
 * Détail d'un groupe (mission section 12, Chantier D) — membres (Player
 * Card, section 8/10 : intégration réelle demandée), rôles, chat, join/leave/
 * delete. Toute action de permission (changer un rôle, supprimer) est
 * garantie côté DB/RLS (0018_group_rls.sql) — les conditions d'affichage
 * ci-dessous ne sont qu'un confort UX, jamais la source de vérité.
 */
export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const selfId = session?.user.id ?? null;

  const { data: group, isLoading: groupLoading, isError: groupError, refetch: refetchGroup } = useGroup(id ?? null);
  const { data: members, isLoading: membersLoading, isError: membersError, refetch: refetchMembers } = useGroupMembers(id ?? null);
  const { data: conversationId } = useGroupConversationId(id ?? null);

  const join = useJoinGroup(selfId ?? "");
  const leave = useLeaveGroup(selfId ?? "");
  const del = useDeleteGroup();
  const setRole = useSetGroupMemberRole(id ?? "");

  const myMembership = useMemo(() => members?.find((m) => m.user_id === selfId) ?? null, [members, selfId]);
  const isOwner = Boolean(group && selfId && group.owner_id === selfId);
  const isMember = Boolean(myMembership);

  if (groupLoading) {
    return (
      <View className="flex-1 gap-3 bg-bg p-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </View>
    );
  }
  if (groupError || !group) {
    return (
      <View className="flex-1 bg-bg p-4">
        <ErrorState message="Impossible de charger ce groupe." onRetry={refetchGroup} />
      </View>
    );
  }

  const confirmDelete = () => {
    Alert.alert("Supprimer ce groupe ?", "Cette action est définitive : membres, chat et messages seront supprimés.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () =>
          del.mutate(group.id, {
            onSuccess: () => {
              toast.success("Groupe supprimé.");
              router.back();
            },
            onError: (err: any) => toast.error(err.message ?? "Erreur"),
          }),
      },
    ]);
  };

  const confirmLeave = () => {
    Alert.alert("Quitter ce groupe ?", `Tu ne feras plus partie de "${group.name}".`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Quitter",
        style: "destructive",
        onPress: () =>
          leave.mutate(group.id, {
            onSuccess: () => {
              toast.success("Tu as quitté le groupe.");
              router.back();
            },
            onError: (err: any) => toast.error(err.message ?? "Erreur"),
          }),
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: group.name }} />
      <Card className="mb-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="font-display text-2xl text-fg">{group.name}</Text>
            {group.description && <Text className="mt-1 text-sm text-fg-muted">{group.description}</Text>}
            <Text className="mt-2 text-xs text-fg-subtle">Groupe social — distinct d&apos;un club Pro Clubs.</Text>
          </View>
          <Badge tone="neutral">{group.visibility === "PUBLIC" ? "Public" : "Privé"}</Badge>
        </View>

        <View className="mt-4 gap-2">
          {!isMember && (
            <Button
              className="min-h-[44px]"
              loading={join.isPending}
              onPress={() =>
                join.mutate(group.id, {
                  onError: (err: any) => toast.error(err.message ?? "Impossible de rejoindre ce groupe."),
                })
              }
            >
              Rejoindre le groupe
            </Button>
          )}

          {isMember && conversationId && (
            <Button
              variant="secondary"
              className="min-h-[44px]"
              icon={<MessageCircle size={16} color="#f4f5f7" />}
              onPress={() => router.push(`/conversation/${conversationId}`)}
            >
              Ouvrir le chat du groupe
            </Button>
          )}

          {isMember && !isOwner && (
            <Button variant="danger" icon={<LogOut size={16} color="#ff4d4f" />} loading={leave.isPending} onPress={confirmLeave}>
              Quitter le groupe
            </Button>
          )}

          {isOwner && (
            <Button variant="danger" icon={<Trash2 size={16} color="#ff4d4f" />} loading={del.isPending} onPress={confirmDelete}>
              Supprimer le groupe
            </Button>
          )}
        </View>
      </Card>

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
        Membres{members ? ` (${members.length})` : ""}
      </Text>

      {membersLoading ? (
        <View className="gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </View>
      ) : membersError ? (
        <ErrorState message="Impossible de charger les membres." onRetry={refetchMembers} />
      ) : !members || members.length === 0 ? (
        <EmptyState title="Aucun membre visible pour l'instant." subtitle="Les joueurs bloqués n'apparaissent pas dans cette liste." />
      ) : (
        <View className="gap-2">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} isOwnerView={isOwner} selfId={selfId} setRole={setRole} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function MemberRow({
  member,
  isOwnerView,
  selfId,
  setRole,
}: {
  member: GroupMemberRow;
  isOwnerView: boolean;
  selfId: string | null;
  setRole: ReturnType<typeof useSetGroupMemberRole>;
}) {
  if (!member.user) return null;
  const cardData = buildPlayerCardData(member.user);
  const canManage = isOwnerView && member.role !== "OWNER" && member.user_id !== selfId;

  return (
    <PlayerCard
      data={cardData}
      variant="mini"
      state={member.role === "OWNER" ? "featured" : "normal"}
      rightSlot={<RoleBadge role={member.role} />}
      footer={
        canManage ? (
          <View className="mt-3 flex-row gap-2 border-t border-border pt-3">
            {member.role !== "ADMIN" && (
              <Button size="sm" variant="secondary" className="flex-1" loading={setRole.isPending} onPress={() => setRole.mutate({ targetUserId: member.user_id, newRole: "ADMIN" })}>
                Promouvoir admin
              </Button>
            )}
            {member.role !== "MEMBER" && (
              <Button size="sm" variant="ghost" className="flex-1" loading={setRole.isPending} onPress={() => setRole.mutate({ targetUserId: member.user_id, newRole: "MEMBER" })}>
                Rétrograder
              </Button>
            )}
          </View>
        ) : undefined
      }
    />
  );
}

function RoleBadge({ role }: { role: GroupMemberRow["role"] }) {
  if (role === "OWNER") {
    return (
      <View className="flex-row items-center gap-1">
        <Crown size={13} color="#e8b84b" />
        <Text className="text-[11px] font-bold text-rarity-gold">Owner</Text>
      </View>
    );
  }
  if (role === "ADMIN") {
    return (
      <View className="flex-row items-center gap-1">
        <Shield size={13} color="#39ff8a" />
        <Text className="text-[11px] font-bold text-accent">Admin</Text>
      </View>
    );
  }
  return <Text className="text-[11px] text-fg-subtle">Membre</Text>;
}

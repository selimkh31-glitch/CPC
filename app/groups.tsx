import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Plus, Users } from "lucide-react-native";
import { Screen, EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { CreateGroupForm } from "@/components/social/CreateGroupForm";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyGroups, usePublicGroups } from "@/lib/hooks/useGroups";
import type { GroupRow } from "@/lib/types";

/**
 * Groupes sociaux — liste (mission section 12, Chantier D). "Mes groupes" +
 * annuaire "Découvrir" (PUBLIC uniquement — RLS `groups_select_visible`).
 * Le "Rejoindre" effectif se fait sur l'écran de détail (source unique de
 * cette action, pas dupliquée ici).
 */
export default function GroupsScreen() {
  const { session } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { data: myGroups, isLoading: myLoading, isError: myError, refetch: refetchMine } = useMyGroups(session?.user.id ?? null);
  const { data: publicGroups, isLoading: publicLoading, isError: publicError, refetch: refetchPublic } = usePublicGroups();

  const myGroupIds = useMemo(() => new Set((myGroups ?? []).map((g) => g.id)), [myGroups]);
  const discoverable = useMemo(() => (publicGroups ?? []).filter((g) => !myGroupIds.has(g.id)), [publicGroups, myGroupIds]);

  return (
    <Screen>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-display text-3xl text-fg">Groupes</Text>
        <Pressable
          hitSlop={8}
          onPress={() => {
            Haptics.selectionAsync();
            setShowCreateForm((v) => !v);
          }}
          className="flex-row items-center gap-1"
        >
          <Plus size={16} color="#39ff8a" />
          <Text className="text-sm font-bold text-accent">{showCreateForm ? "Annuler" : "Créer"}</Text>
        </Pressable>
      </View>

      {showCreateForm && (
        <View className="mb-6">
          <CreateGroupForm onCreated={(group) => { setShowCreateForm(false); router.push(`/group/${group.id}`); }} />
        </View>
      )}

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">👥 Mes groupes</Text>
      {myLoading ? (
        <View className="mb-6 gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </View>
      ) : myError ? (
        <View className="mb-6">
          <ErrorState message="Impossible de charger tes groupes." onRetry={refetchMine} />
        </View>
      ) : !myGroups || myGroups.length === 0 ? (
        <View className="mb-6">
          <EmptyState title="Tu n'as encore rejoint aucun groupe." subtitle="Crée le tien ou découvre-en un ci-dessous." />
        </View>
      ) : (
        <View className="mb-6 gap-2">
          {myGroups.map((group) => (
            <GroupRowItem key={group.id} group={group} />
          ))}
        </View>
      )}

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">🔍 Découvrir</Text>
      {publicLoading ? (
        <View className="gap-2">
          <Skeleton className="h-16" />
        </View>
      ) : publicError ? (
        <ErrorState message="Impossible de charger l'annuaire des groupes." onRetry={refetchPublic} />
      ) : discoverable.length === 0 ? (
        <EmptyState title="Aucun autre groupe public pour l'instant." />
      ) : (
        <View className="gap-2">
          {discoverable.map((group) => (
            <GroupRowItem key={group.id} group={group} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function GroupRowItem({ group }: { group: GroupRow }) {
  return (
    <Pressable
      onPress={() => router.push(`/group/${group.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le groupe ${group.name}`}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-bg-card p-3 active:opacity-80"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-border bg-bg-elevated">
        <Users size={18} color="#9aa0a8" />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="font-display text-base text-fg">
          {group.name}
        </Text>
        {group.description && (
          <Text numberOfLines={1} className="text-xs text-fg-subtle">
            {group.description}
          </Text>
        )}
      </View>
      <Badge tone="neutral">{group.visibility === "PUBLIC" ? "Public" : "Privé"}</Badge>
    </Pressable>
  );
}

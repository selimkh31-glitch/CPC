import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Plus, Users } from "lucide-react-native";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { CreateGroupForm } from "@/components/social/CreateGroupForm";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyGroups, usePublicGroups } from "@/lib/hooks/useGroups";
import type { GroupRow } from "@/lib/types";

/**
 * Groupes sociaux — distincts d'un club Pro Clubs. Création via create-group.
 * Pas d'onglet dédié : stack `/groups`.
 */
export default function GroupsScreen() {
  const { session } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { data: myGroups, isLoading: myLoading, isError: myError, refetch: refetchMine } = useMyGroups(session?.user.id ?? null);
  const { data: publicGroups, isLoading: publicLoading, isError: publicError, refetch: refetchPublic } = usePublicGroups();

  const myGroupIds = useMemo(() => new Set((myGroups ?? []).map((g) => g.id)), [myGroups]);
  const discoverable = useMemo(() => (publicGroups ?? []).filter((g) => !myGroupIds.has(g.id)), [publicGroups, myGroupIds]);

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-display text-2xl text-fg">Groupes</Text>
          <Text className="mt-1 text-xs text-fg-subtle">Social, distinct d&apos;un club EA SPORTS FC 27 Pro Clubs.</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => {
            Haptics.selectionAsync();
            setShowCreateForm((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel={showCreateForm ? "Annuler la création" : "Créer un groupe"}
          className="min-h-[44px] flex-row items-center gap-1 px-2"
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

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Mes groupes</Text>
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
          <EmptyState
            title="Tu n'as encore rejoint aucun groupe."
            subtitle="Crée le tien (create-group) ou découvre un groupe public ci-dessous."
          />
        </View>
      ) : (
        <View className="mb-6 gap-2">
          {myGroups.map((group) => (
            <GroupRowItem key={group.id} group={group} />
          ))}
        </View>
      )}

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Découvrir</Text>
      {publicLoading ? (
        <View className="gap-2">
          <Skeleton className="h-16" />
        </View>
      ) : publicError ? (
        <ErrorState message="Impossible de charger l'annuaire des groupes." onRetry={refetchPublic} />
      ) : discoverable.length === 0 ? (
        <EmptyState title="Aucun autre groupe public pour l'instant." subtitle="Les groupes privés n'apparaissent pas dans l'annuaire." />
      ) : (
        <View className="gap-2">
          {discoverable.map((group) => (
            <GroupRowItem key={group.id} group={group} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function GroupRowItem({ group }: { group: GroupRow }) {
  return (
    <Pressable
      onPress={() => router.push(`/group/${group.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le groupe ${group.name}`}
      className="min-h-[44px] flex-row items-center gap-3 rounded-2xl border border-border bg-bg-card p-3 active:opacity-80"
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

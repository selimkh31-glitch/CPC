import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Users } from "lucide-react-native";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { CreateGroupForm } from "@/components/social/CreateGroupForm";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyGroups, usePublicGroups } from "@/lib/hooks/useGroups";
import { CHAT_UX_COPY } from "@/lib/social";
import type { GroupRow } from "@/lib/types";

/**
 * Groupes — distincts d'un club. Création ici, pas un onglet.
 */
export default function GroupsScreen() {
  const { session } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { data: myGroups, isLoading: myLoading, isError: myError, refetch: refetchMine } = useMyGroups(session?.user.id ?? null);
  const { data: publicGroups, isLoading: publicLoading, isError: publicError, refetch: refetchPublic } = usePublicGroups();

  const myGroupIds = useMemo(() => new Set((myGroups ?? []).map((g) => g.id)), [myGroups]);
  const discoverable = useMemo(() => (publicGroups ?? []).filter((g) => !myGroupIds.has(g.id)), [publicGroups, myGroupIds]);
  const mineEmpty = !myLoading && !myError && (!myGroups || myGroups.length === 0);

  const openCreate = () => {
    Haptics.selectionAsync();
    setShowCreateForm(true);
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View className="mb-5 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-display text-2xl text-fg">Groupes</Text>
          <Text className="mt-1 text-sm text-fg-muted">Tes copains. Pas un club.</Text>
        </View>
        {!showCreateForm ? (
          <Pressable
            onPress={openCreate}
            accessibilityRole="button"
            accessibilityLabel={CHAT_UX_COPY.newGroup}
            className="min-h-[44px] justify-center"
          >
            <Text className="text-sm font-bold text-accent">{CHAT_UX_COPY.newGroup}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setShowCreateForm(false)}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            className="min-h-[44px] justify-center"
          >
            <Text className="text-sm text-fg-subtle">Annuler</Text>
          </Pressable>
        )}
      </View>

      {showCreateForm ? (
        <View className="mb-8">
          <CreateGroupForm
            onCreated={(group) => {
              setShowCreateForm(false);
              router.push(`/group/${group.id}`);
            }}
          />
        </View>
      ) : null}

      <Text className="mb-3 text-sm text-fg-subtle">Les tiens</Text>
      {myLoading ? (
        <View className="mb-8 gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </View>
      ) : myError ? (
        <View className="mb-8">
          <ErrorState message="Impossible de charger tes groupes." onRetry={refetchMine} />
        </View>
      ) : mineEmpty && !showCreateForm ? (
        <View className="mb-8">
          <Text className="mb-4 text-sm text-fg-muted">Personne encore. Crée le tien.</Text>
          <Pressable
            onPress={openCreate}
            className="min-h-[48px] items-center justify-center rounded-2xl bg-accent active:opacity-90"
            accessibilityRole="button"
            accessibilityLabel={CHAT_UX_COPY.newGroup}
          >
            <Text className="text-base font-bold text-bg">{CHAT_UX_COPY.newGroup}</Text>
          </Pressable>
        </View>
      ) : mineEmpty ? (
        <View className="mb-8" />
      ) : (
        <View className="mb-8 gap-1">
          {myGroups!.map((group) => (
            <GroupRowItem key={group.id} group={group} />
          ))}
        </View>
      )}

      <Text className="mb-3 text-sm text-fg-subtle">Autres groupes</Text>
      {publicLoading ? (
        <View className="gap-2">
          <Skeleton className="h-16" />
        </View>
      ) : publicError ? (
        <ErrorState message="Impossible de charger les groupes." onRetry={refetchPublic} />
      ) : discoverable.length === 0 ? (
        <EmptyState title="Pas d'autre groupe public." subtitle="Les groupes privés n'apparaissent pas ici." />
      ) : (
        <View className="gap-1">
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
      accessibilityLabel={`Ouvrir ${group.name}`}
      className="min-h-[64px] flex-row items-center gap-3 py-3 active:opacity-80"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-bg-elevated">
        <Users size={18} color="#9aa0a8" />
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-display text-base text-fg">
          {group.name}
        </Text>
        {group.description ? (
          <Text numberOfLines={1} className="mt-0.5 text-sm text-fg-subtle">
            {group.description}
          </Text>
        ) : (
          <Text className="mt-0.5 text-sm text-fg-subtle">{CHAT_UX_COPY.kindGroup}</Text>
        )}
      </View>
    </Pressable>
  );
}

import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import { Users } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PulseDot } from "@/components/ui/PulseDot";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { CLUB_LEVEL_LABELS, LANGUAGE_LABELS } from "@/lib/constants";
import { useClubsList } from "@/lib/hooks/useClubs";
import { isLiveActive } from "@/lib/live";
import { clubPublicHref } from "@/lib/clubProfile";
import { useLiveClock } from "@/lib/hooks/useLiveClock";

/** Annuaire complet — extrait de l'ancien onglet Clubs (Mode Joueur). */
export function ClubsDirectory({ hideTitle = false }: { hideTitle?: boolean }) {
  const now = useLiveClock();
  const { data: clubs, isLoading, isError, refetch, isRefetching } = useClubsList();

  return (
    <FlatList
      className="flex-1"
      data={clubs}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#39ff8a" />}
      ListHeaderComponent={
        hideTitle ? null : (
          <View className="mb-2 flex-row items-center gap-2">
            <Users size={20} color="#39ff8a" />
            <Text className="font-display text-xl text-fg">Tous les clubs</Text>
          </View>
        )
      }
      ListEmptyComponent={
        isLoading ? (
          <View className="gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message="Impossible de charger les clubs." onRetry={refetch} />
        ) : (
          <EmptyState title="Aucun club pour l'instant." subtitle="Sois le premier à en créer un." />
        )
      }
      renderItem={({ item: club }) => {
        const isLive = club.sessions?.some((s) => isLiveActive(s, now));
        return (
          <Pressable
            onPress={() => router.push(clubPublicHref(club.id))}
            accessibilityRole="button"
            accessibilityLabel={`Voir ${club.name}`}
            className="active:opacity-90"
          >
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="font-display text-lg text-fg">{club.name}</Text>
                {isLive && <PulseDot />}
              </View>
              <Badge tone={club.level === "COMPETITIVE" ? "accent" : "neutral"} className="mt-1.5">
                {CLUB_LEVEL_LABELS[club.level]}
              </Badge>
              {club.description && (
                <Text numberOfLines={2} className="mt-2 text-sm text-fg-muted">
                  {club.description}
                </Text>
              )}
              <Text className="mt-2 text-xs text-fg-subtle">
                {club.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}
              </Text>
            </Card>
          </Pressable>
        );
      }}
      ItemSeparatorComponent={() => <View className="h-3" />}
    />
  );
}

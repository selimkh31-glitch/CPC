import { FlatList, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import { Users } from "lucide-react-native";
import { ClubCard } from "@/components/club/ClubCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { useClubsList } from "@/lib/hooks/useClubs";
import { isLiveActive } from "@/lib/live";
import { clubPublicHref } from "@/lib/clubProfile";
import { buildClubCardData } from "@/lib/clubCard";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useModeAccent } from "@/lib/theme";

/** Annuaire complet — extrait de l'ancien onglet Clubs (Mode Joueur). */
export function ClubsDirectory({ hideTitle = false }: { hideTitle?: boolean }) {
  const now = useLiveClock();
  const accent = useModeAccent();
  const { data: clubs, isLoading, isError, refetch, isRefetching } = useClubsList();

  return (
    <FlatList
      className="flex-1"
      data={clubs}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
      ListHeaderComponent={
        hideTitle ? null : (
          <View className="mb-2 flex-row items-center gap-2">
            <Users size={20} color={accent} />
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
        const liveSession = club.sessions?.find((s) => isLiveActive(s, now));
        return (
          <ClubCard
            data={buildClubCardData(club, {
              live: Boolean(liveSession),
              liveExpiresAt: liveSession?.expires_at ?? null,
            })}
            variant="compact"
            onPress={() => router.push(clubPublicHref(club.id))}
          />
        );
      }}
      ItemSeparatorComponent={() => <View className="h-3" />}
    />
  );
}

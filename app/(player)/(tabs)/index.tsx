import { useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Radio } from "lucide-react-native";
import { LiveClubCard } from "@/components/live/LiveClubCard";
import { LiveFilters, EMPTY_LIVE_FILTERS, type LiveFiltersState } from "@/components/live/LiveFilters";
import { SmartMatchBanner } from "@/components/live/SmartMatchBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { useLiveSessions } from "@/lib/hooks/useLiveSessions";

/**
 * Écran principal (section 7) : ouvrir l'app -> voir les clubs LIVE -> voir
 * les postes recherchés -> sélectionner un club -> postuler en quelques secondes.
 */
export default function LiveScreen() {
  const { data: items, isLoading, isError, refetch, isRefetching } = useLiveSessions();
  const [filters, setFilters] = useState<LiveFiltersState>(EMPTY_LIVE_FILTERS);

  const filtered = useMemo(() => {
    return (items ?? []).filter((item) => {
      if (!item.club) return false;
      if (filters.position && !item.needed_positions.includes(filters.position as any)) return false;
      if (filters.level && item.club.level !== filters.level) return false;
      if (filters.language && !item.club.languages.includes(filters.language)) return false;
      return true;
    });
  }, [items, filters]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#39ff8a" />}
        ListHeaderComponent={
          <View className="mb-4">
            <View className="mb-4 flex-row items-center gap-2">
              <Radio size={22} color="#39ff8a" />
              <Text className="font-display text-3xl text-fg">Live Feed</Text>
              <Text className="ml-auto text-sm text-fg-muted">{filtered.length} clubs live</Text>
            </View>
            <SmartMatchBanner />
            <LiveFilters value={filters} onChange={setFilters} />
          </View>
        }
        renderItem={({ item }) => <LiveClubCard item={item} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </View>
          ) : isError ? (
            <ErrorState message="Impossible de charger le Live Feed." onRetry={refetch} />
          ) : (
            <EmptyState
              title="Aucun club live pour ces filtres."
              subtitle="Reviens plus tard, ou passe ton club en LIVE depuis le dashboard."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

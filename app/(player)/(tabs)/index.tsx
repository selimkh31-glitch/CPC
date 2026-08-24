import { useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Radio } from "lucide-react-native";
import { LiveClubCard } from "@/components/live/LiveClubCard";
import { LivePlayerCard } from "@/components/live/LivePlayerCard";
import { PlayerLivePanel } from "@/components/live/PlayerLivePanel";
import { LiveFilters, EMPTY_LIVE_FILTERS, type LiveFiltersState } from "@/components/live/LiveFilters";
import { SmartMatchBanner } from "@/components/live/SmartMatchBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { useLiveSessions } from "@/lib/hooks/useLiveSessions";
import { useLivePlayers } from "@/lib/hooks/usePlayerLive";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useAuth } from "@/lib/providers/AuthProvider";
import { isLiveActive } from "@/lib/live";

/**
 * Accueil Mode Joueur : clubs LIVE qui recrutent + joueurs LIVE + ton propre LIVE.
 * Recrutement EA SPORTS FC 27 Pro Clubs uniquement.
 */
export default function LiveScreen() {
  const { session } = useAuth();
  const { data: items, isLoading, isError, refetch, isRefetching } = useLiveSessions();
  const {
    data: livePlayers,
    isLoading: playersLoading,
    refetch: refetchPlayers,
    isRefetching: playersRefetching,
  } = useLivePlayers();
  const [filters, setFilters] = useState<LiveFiltersState>(EMPTY_LIVE_FILTERS);
  const now = useLiveClock();

  const filtered = useMemo(() => {
    return (items ?? []).filter((item) => {
      if (!item.club || !isLiveActive(item, now)) return false;
      if (filters.position && !item.needed_positions.includes(filters.position as any)) return false;
      if (filters.level && item.club.level !== filters.level) return false;
      if (filters.language && !item.club.languages.includes(filters.language)) return false;
      return true;
    });
  }, [items, filters, now]);

  const otherLivePlayers = useMemo(() => {
    const selfId = session?.user.id;
    return (livePlayers ?? []).filter((row) => {
      if (!isLiveActive(row, now) || !row.user || row.user_id === selfId) return false;
      if (filters.position && row.user.main_position !== filters.position && !row.user.secondary_positions?.includes(filters.position as any)) {
        return false;
      }
      return true;
    });
  }, [livePlayers, filters.position, session?.user.id, now]);

  const refreshing = isRefetching || playersRefetching;
  const onRefresh = () => {
    refetch();
    refetchPlayers();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39ff8a" />}
        ListHeaderComponent={
          <View className="mb-4">
            <View className="mb-1 flex-row items-center gap-2">
              <Radio size={22} color="#39ff8a" />
              <Text className="font-display text-3xl text-fg">Live Feed</Text>
              <Text className="ml-auto text-sm text-fg-muted">{filtered.length} clubs</Text>
            </View>
            <Text className="mb-4 text-xs text-fg-muted">Recrutement roster EA SPORTS FC 27 Pro Clubs.</Text>
            <PlayerLivePanel />
            <SmartMatchBanner />
            <LiveFilters value={filters} onChange={setFilters} />
            {otherLivePlayers.length > 0 && (
              <View className="mt-4 mb-2">
                <Text className="mb-2 font-display text-lg text-fg">Joueurs LIVE</Text>
                <View className="gap-3">
                  {otherLivePlayers.map((item) => (
                    <LivePlayerCard key={item.id} item={item} />
                  ))}
                </View>
              </View>
            )}
            <Text className="mt-4 mb-1 font-display text-lg text-fg">Clubs LIVE</Text>
          </View>
        }
        renderItem={({ item }) => <LiveClubCard item={item} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          isLoading || playersLoading ? (
            <View className="gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </View>
          ) : isError ? (
            <ErrorState message="Impossible de charger le Live Feed." onRetry={onRefresh} />
          ) : (
            <EmptyState
              title="Aucun club LIVE pour ces filtres."
              subtitle="Passe ton club en LIVE depuis le Mode Club, avec une durée."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

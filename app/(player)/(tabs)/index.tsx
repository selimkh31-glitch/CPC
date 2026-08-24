import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Radio } from "lucide-react-native";
import { LiveClubCard } from "@/components/live/LiveClubCard";
import { LivePlayerCard } from "@/components/live/LivePlayerCard";
import { PlayerLivePanel } from "@/components/live/PlayerLivePanel";
import { LiveFilters, EMPTY_LIVE_FILTERS, type LiveFiltersState } from "@/components/live/LiveFilters";
import { SmartMatchBanner } from "@/components/live/SmartMatchBanner";
import { FindClubPanel } from "@/components/club/FindClubPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { useLiveSessions } from "@/lib/hooks/useLiveSessions";
import { useLivePlayers } from "@/lib/hooks/usePlayerLive";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useAuth } from "@/lib/providers/AuthProvider";
import { isLiveActive } from "@/lib/live";

type LivePane = "feed" | "find";

/**
 * Accueil Mode Joueur : clubs LIVE qui recrutent + joueurs LIVE + ton propre LIVE.
 * Trouver un club vit ici (plus d'onglet Clubs). Recrutement EA SPORTS FC 27 Pro Clubs uniquement.
 */
export default function LiveScreen() {
  const { session } = useAuth();
  const { data: items, isLoading, isError, refetch, isRefetching } = useLiveSessions();
  const {
    data: livePlayers,
    isLoading: playersLoading,
    isError: playersError,
    refetch: refetchPlayers,
    isRefetching: playersRefetching,
  } = useLivePlayers();
  const [filters, setFilters] = useState<LiveFiltersState>(EMPTY_LIVE_FILTERS);
  const [pane, setPane] = useState<LivePane>("feed");
  const now = useLiveClock();

  const filtered = useMemo(() => {
    return (items ?? []).filter((item) => {
      if (!item.club || !isLiveActive(item, now)) return false;
      if (filters.position && !item.needed_positions.includes(filters.position as any)) return false;
      if (filters.platform && item.club.owner?.platform !== filters.platform) return false;
      if (filters.level && item.club.level !== filters.level) return false;
      if (filters.language && !item.club.languages.includes(filters.language)) return false;
      if ((item.needed_positions?.length ?? 0) === 0) return false;
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
      if (filters.platform && row.user.platform !== filters.platform) return false;
      return true;
    });
  }, [livePlayers, filters.position, filters.platform, session?.user.id, now]);

  const refreshing = isRefetching || playersRefetching;
  const onRefresh = () => {
    refetch();
    refetchPlayers();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {pane === "find" ? (
        <View className="flex-1">
          <View className="px-4 pt-2">
            <LivePaneHeader pane={pane} onPane={setPane} clubCount={filtered.length} />
          </View>
          <FindClubPanel />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39ff8a" />}
          ListHeaderComponent={
            <View className="mb-4">
              <LivePaneHeader pane={pane} onPane={setPane} clubCount={filtered.length} />
              <PlayerLivePanel />
              <SmartMatchBanner />
              <LiveFilters value={filters} onChange={setFilters} />
              {playersError ? (
                <View className="mt-4 mb-2">
                  <ErrorState message="Impossible de charger les joueurs LIVE." onRetry={refetchPlayers} />
                </View>
              ) : otherLivePlayers.length > 0 ? (
                <View className="mt-4 mb-2">
                  <Text className="mb-2 font-display text-lg text-fg">Joueurs LIVE</Text>
                  <View className="gap-3">
                    {otherLivePlayers.map((item) => (
                      <LivePlayerCard key={item.id} item={item} />
                    ))}
                  </View>
                </View>
              ) : null}
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
      )}
    </SafeAreaView>
  );
}

function LivePaneHeader({
  pane,
  onPane,
  clubCount,
}: {
  pane: LivePane;
  onPane: (pane: LivePane) => void;
  clubCount: number;
}) {
  return (
    <View className="mb-4">
      <View className="mb-1 flex-row items-center gap-2">
        <Radio size={22} color="#39ff8a" />
        <Text className="font-display text-3xl text-fg">LIVE</Text>
        {pane === "feed" && <Text className="ml-auto text-sm text-fg-muted">{clubCount} clubs</Text>}
      </View>
      <Text className="mb-3 text-xs text-fg-muted">Recrutement roster EA SPORTS FC 27 Pro Clubs.</Text>
      <View className="flex-row rounded-2xl border border-border bg-bg-elevated p-1">
        <Pressable
          onPress={() => onPane("feed")}
          className={`flex-1 rounded-xl px-3 py-2 ${pane === "feed" ? "bg-accent" : ""}`}
        >
          <Text className={`text-center text-sm font-bold ${pane === "feed" ? "text-bg" : "text-fg-muted"}`}>LIVE</Text>
        </Pressable>
        <Pressable
          onPress={() => onPane("find")}
          className={`flex-1 rounded-xl px-3 py-2 ${pane === "find" ? "bg-accent" : ""}`}
        >
          <Text className={`text-center text-sm font-bold ${pane === "find" ? "text-bg" : "text-fg-muted"}`}>
            Trouver un club
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

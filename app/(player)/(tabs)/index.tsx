import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import { LivePlayerCard } from "@/components/live/LivePlayerCard";
import { PlayerLivePanel } from "@/components/live/PlayerLivePanel";
import { FindClubPanel } from "@/components/club/FindClubPanel";
import { ErrorState } from "@/components/ui/Screen";
import { useLiveSessions } from "@/lib/hooks/useLiveSessions";
import { useLivePlayers, useMyPlayerSession } from "@/lib/hooks/usePlayerLive";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useAuth } from "@/lib/providers/AuthProvider";
import { isLiveActive, liveFeedEmptyCopy, LIVE_UX_COPY } from "@/lib/live";
import { useCurrentClubsByUserIds } from "@/lib/hooks/useCurrentClubs";

type LivePane = "feed" | "find";

/**
 * LIVE Mode Joueur — un état, un CTA : Passer LIVE.
 * Clubs en LIVE = secondaire. Matching / TTL inchangés.
 */
export default function LiveScreen() {
  const { session } = useAuth();
  const { data: items, refetch, isRefetching } = useLiveSessions();
  const {
    data: livePlayers,
    isError: playersError,
    refetch: refetchPlayers,
    isRefetching: playersRefetching,
  } = useLivePlayers();
  const { data: mySession } = useMyPlayerSession(session?.user.id ?? null);
  const [pane, setPane] = useState<LivePane>("feed");
  const now = useLiveClock();

  const liveClubCount = useMemo(
    () => (items ?? []).filter((item) => item.club && isLiveActive(item, now) && (item.needed_positions?.length ?? 0) > 0).length,
    [items, now]
  );

  const otherLivePlayers = useMemo(() => {
    const selfId = session?.user.id;
    return (livePlayers ?? []).filter((row) => isLiveActive(row, now) && row.user && row.user_id !== selfId);
  }, [livePlayers, session?.user.id, now]);
  const { data: clubsByUser } = useCurrentClubsByUserIds(otherLivePlayers.map((row) => row.user_id));
  const selfLive = isLiveActive(mySession, now);

  const refreshing = isRefetching || playersRefetching;
  const onRefresh = () => {
    refetch();
    refetchPlayers();
  };

  const switchPane = (next: LivePane) => {
    Haptics.selectionAsync();
    setPane(next);
  };

  const showFeedEmpty = !playersError && otherLivePlayers.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {pane === "find" ? (
        <View className="flex-1">
          <View className="px-4 pt-2">
            <Pressable
              onPress={() => switchPane("feed")}
              className="min-h-[44px] flex-row items-center gap-1 self-start py-1"
              accessibilityRole="button"
              accessibilityLabel={`Retour ${LIVE_UX_COPY.backToLive}`}
            >
              <ChevronLeft size={18} color="#9aa0a8" />
              <Text className="text-sm font-bold text-fg-muted">{LIVE_UX_COPY.backToLive}</Text>
            </Pressable>
          </View>
          <FindClubPanel onCreateSession={() => switchPane("feed")} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39ff8a" />}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-5 font-display text-2xl text-fg">{LIVE_UX_COPY.title}</Text>
          <PlayerLivePanel />

          <Pressable
            onPress={() => switchPane("find")}
            className="mb-6 min-h-[44px] justify-center py-1 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel={LIVE_UX_COPY.findClub}
          >
            <Text className="text-sm text-fg-subtle">
              {LIVE_UX_COPY.findClub}
              {liveClubCount > 0 ? ` · ${LIVE_UX_COPY.liveClubsNow(liveClubCount)}` : ""}
            </Text>
          </Pressable>

          {playersError ? (
            <View className="mb-2">
              <ErrorState message="Impossible de charger les joueurs LIVE." onRetry={refetchPlayers} />
            </View>
          ) : otherLivePlayers.length > 0 ? (
            <View>
              <Text className="mb-3 text-sm text-fg-subtle">{LIVE_UX_COPY.otherPlayers}</Text>
              <View className="gap-3">
                {otherLivePlayers.map((item) => (
                  <LivePlayerCard
                    key={item.id}
                    item={item}
                    clubName={clubsByUser?.get(item.user_id)?.name ?? null}
                    clubId={clubsByUser?.get(item.user_id)?.id ?? null}
                  />
                ))}
              </View>
            </View>
          ) : showFeedEmpty && (selfLive || liveClubCount > 0) ? (
            <Text className="text-sm text-fg-subtle">{liveFeedEmptyCopy({ selfLive, liveClubCount })}</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

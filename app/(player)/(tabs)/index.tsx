import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LivePlayerCard } from "@/components/live/LivePlayerCard";
import { PlayerLivePanel } from "@/components/live/PlayerLivePanel";
import { FindClubPanel } from "@/components/club/FindClubPanel";
import { ErrorState } from "@/components/ui/Screen";
import { useLiveSessions } from "@/lib/hooks/useLiveSessions";
import { useLivePlayers } from "@/lib/hooks/usePlayerLive";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useAuth } from "@/lib/providers/AuthProvider";
import { isLiveActive } from "@/lib/live";

type LivePane = "feed" | "find";

/**
 * Accueil Mode Joueur : LIVE (dispo maintenant) + Trouver un club.
 * Recrutement EA SPORTS FC 27 Pro Clubs uniquement.
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

  const refreshing = isRefetching || playersRefetching;
  const onRefresh = () => {
    refetch();
    refetchPlayers();
  };

  const switchPane = (next: LivePane) => {
    Haptics.selectionAsync();
    setPane(next);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {pane === "find" ? (
        <View className="flex-1">
          <View className="px-4 pt-2">
            <LivePaneHeader pane={pane} onPane={switchPane} />
          </View>
          <FindClubPanel />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39ff8a" />}
          keyboardShouldPersistTaps="handled"
        >
          <LivePaneHeader pane={pane} onPane={switchPane} />
          <PlayerLivePanel />

          <Pressable
            onPress={() => switchPane("find")}
          className="mb-4 min-h-[44px] flex-row items-center justify-between rounded-xl bg-bg-elevated px-3 py-2.5"
            accessibilityRole="button"
            accessibilityLabel="Voir les clubs LIVE"
          >
            <Text className="text-sm text-fg-muted">
              {liveClubCount > 0
                ? `${liveClubCount} club${liveClubCount > 1 ? "s" : ""} LIVE maintenant`
                : "Aucun club LIVE pour l'instant"}
            </Text>
            <Text className="text-xs font-bold text-fg">Trouver →</Text>
          </Pressable>

          {playersError ? (
            <View className="mb-2">
              <ErrorState message="Impossible de charger les joueurs LIVE." onRetry={refetchPlayers} />
            </View>
          ) : otherLivePlayers.length > 0 ? (
            <View>
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-subtle">Autres joueurs LIVE</Text>
              <View className="gap-2.5">
                {otherLivePlayers.map((item) => (
                  <LivePlayerCard key={item.id} item={item} />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LivePaneHeader({ pane, onPane }: { pane: LivePane; onPane: (pane: LivePane) => void }) {
  return (
    <View className="mb-3">
      <Text className="mb-2 font-display text-2xl text-fg">Tu veux jouer maintenant ?</Text>
      <View className="flex-row rounded-2xl border border-border bg-bg-elevated p-1">
        <Pressable
          onPress={() => onPane("feed")}
          className={`min-h-[44px] flex-1 justify-center rounded-xl px-3 py-2.5 ${pane === "feed" ? "bg-accent" : ""}`}
          accessibilityRole="button"
          accessibilityState={{ selected: pane === "feed" }}
        >
          <Text className={`text-center text-sm font-bold ${pane === "feed" ? "text-bg" : "text-fg-muted"}`}>LIVE</Text>
        </Pressable>
        <Pressable
          onPress={() => onPane("find")}
          className={`min-h-[44px] flex-1 justify-center rounded-xl px-3 py-2.5 ${pane === "find" ? "bg-accent" : ""}`}
          accessibilityRole="button"
          accessibilityState={{ selected: pane === "find" }}
        >
          <Text className={`text-center text-sm font-bold ${pane === "find" ? "text-bg" : "text-fg-muted"}`}>
            Trouver un club
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

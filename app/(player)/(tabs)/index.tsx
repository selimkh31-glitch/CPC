import { useMemo, useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { LiveClubCard } from "@/components/live/LiveClubCard";
import { MatchmakingFilters } from "@/components/live/MatchmakingFilters";
import { PlayerLivePanel } from "@/components/live/PlayerLivePanel";
import { AppShell } from "@/components/nav/AppShell";
import { ErrorState } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLiveSessions } from "@/lib/hooks/useLiveSessions";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { isLiveActive, LIVE_UX_COPY } from "@/lib/live";
import { EMPTY_LIVE_FILTERS, clubSessionMatchesLiveFilters } from "@/lib/liveFilters";
import { useModeAccent } from "@/lib/theme";
import { cpcTokens } from "@/lib/design/cpc-tokens";

/**
 * Matchmaking Mode Joueur — un scroll : Passer LIVE + clubs en LIVE.
 * Matching / TTL inchangés. Pas de joueurs LIVE, pas de Trouver un club.
 */
export default function LiveScreen() {
  const { data: items, refetch, isRefetching, isError: clubsError } = useLiveSessions();
  const now = useLiveClock();
  const accent = useModeAccent();
  const [filters, setFilters] = useState(EMPTY_LIVE_FILTERS);

  const liveClubs = useMemo(
    () =>
      (items ?? []).filter(
        (item) =>
          item.club &&
          isLiveActive(item, now) &&
          (item.needed_positions?.length ?? 0) > 0 &&
          clubSessionMatchesLiveFilters(item, filters)
      ),
    [items, now, filters]
  );

  return (
    <AppShell
      edges={[]}
      contentContainerStyle={{ gap: 28 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={accent} />}
    >
      <Text className="font-display text-display text-fg" style={{ lineHeight: cpcTokens.font.lineHeight.display }}>
        {LIVE_UX_COPY.title}
      </Text>
      <PlayerLivePanel />
      <MatchmakingFilters value={filters} onChange={setFilters} />

      <View className="mb-2">
        <SectionHeader title={LIVE_UX_COPY.findClub} />
        {clubsError ? (
          <ErrorState message="Impossible de charger les clubs LIVE." onRetry={refetch} />
        ) : liveClubs.length > 0 ? (
          <View className="gap-3">
            {liveClubs.map((item) => (
              <LiveClubCard key={item.id} item={item} />
            ))}
          </View>
        ) : (
          <Text className="text-sm text-fg-muted">{LIVE_UX_COPY.noLiveClubs}</Text>
        )}
      </View>
    </AppShell>
  );
}

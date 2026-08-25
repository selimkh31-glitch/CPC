import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import { LiveClubCard } from "@/components/live/LiveClubCard";
import { LiveFilters } from "@/components/live/LiveFilters";
import { SmartMatchBanner } from "@/components/live/SmartMatchBanner";
import { ClubMatchmaking } from "@/components/club/ClubMatchmaking";
import { ClubsDirectory } from "@/components/club/ClubsDirectory";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { useLiveSessions } from "@/lib/hooks/useLiveSessions";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useAuth } from "@/lib/providers/AuthProvider";
import { isLiveActive } from "@/lib/live";
import { rankLiveClubsForPlayer } from "@/lib/liveMatch";
import {
  EMPTY_LIVE_FILTERS,
  canWidenLiveFilters,
  clubSessionMatchesLiveFilters,
  liveFiltersAreEmpty,
  type LiveFiltersState,
  widenLiveFilters,
} from "@/lib/liveFilters";
import { PLATFORM_LABELS, POSITION_LABELS } from "@/lib/constants";

type FindMode = "live" | "matchmaking" | "directory";

/**
 * Trouver un club — cœur de l'écran joueur.
 * Discovery (annuaire) et Matchmaking (slots / moteur déterministe) restent distincts
 * du feed LIVE. Aucun club inventé, aucun % de compatibilité.
 */
export function FindClubPanel() {
  const { profile } = useAuth();
  const { data: items, isLoading, isError, refetch, isRefetching } = useLiveSessions();
  const now = useLiveClock();
  const [filters, setFilters] = useState<LiveFiltersState>(EMPTY_LIVE_FILTERS);
  const [mode, setMode] = useState<FindMode>("live");
  const [relaxed, setRelaxed] = useState(false);

  const activeLive = useMemo(
    () => (items ?? []).filter((item) => item.club && isLiveActive(item, now) && (item.needed_positions?.length ?? 0) > 0),
    [items, now]
  );

  const filtered = useMemo(
    () => activeLive.filter((item) => clubSessionMatchesLiveFilters(item, filters)),
    [activeLive, filters]
  );

  const matchResults = useMemo(() => {
    if (!profile) return [];
    return rankLiveClubsForPlayer(
      {
        mainPosition: profile.main_position,
        secondaryPositions: profile.secondary_positions ?? [],
        platform: profile.platform,
      },
      activeLive.map((s) => ({
        clubId: s.club!.id,
        sessionId: s.id,
        neededPositions: s.needed_positions ?? [],
        platform: s.club?.owner?.platform ?? null,
        is_live: s.is_live,
        expires_at: s.expires_at,
      })),
      now
    );
  }, [profile, activeLive, now]);

  const reasonBySession = useMemo(
    () => new Map(matchResults.map((m) => [m.sessionId, m.reason])),
    [matchResults]
  );
  const eligibleIds = useMemo(() => new Set(matchResults.map((m) => m.sessionId)), [matchResults]);

  const filtersEmpty = liveFiltersAreEmpty(filters);

  const displayed = useMemo(() => {
    const pool = filtersEmpty ? activeLive : filtered;
    if (filtersEmpty && !relaxed && profile) {
      const rank = new Map(matchResults.map((m, i) => [m.sessionId, i]));
      return pool
        .filter((s) => eligibleIds.has(s.id))
        .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
    }
    return pool;
  }, [filtersEmpty, activeLive, filtered, relaxed, profile, eligibleIds, matchResults]);

  const widen = () => {
    Haptics.selectionAsync();
    if (canWidenLiveFilters(filters)) {
      const next = widenLiveFilters(filters);
      setFilters(next);
      if (liveFiltersAreEmpty(next)) setRelaxed(true);
      return;
    }
    setRelaxed(true);
  };

  const canWiden = canWidenLiveFilters(filters) || (!relaxed && filtersEmpty && activeLive.length > displayed.length);

  const setModeSafe = (next: FindMode) => {
    Haptics.selectionAsync();
    setMode(next);
  };

  const liquidityLabel =
    activeLive.length > 0
      ? `${activeLive.length} club${activeLive.length > 1 ? "s" : ""} LIVE maintenant`
      : "Aucun club LIVE pour l'instant";

  const onRefresh = () => {
    refetch();
  };

  return (
    <View className="flex-1">
      <View className="px-4 pt-1">
        <View className="mb-3 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-display text-xl text-fg">Trouver un club</Text>
            <Text className="mt-0.5 text-sm text-fg-muted">On cherche les clubs qui correspondent à ton profil.</Text>
          </View>
          {mode === "directory" ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus size={16} color="#f4f5f7" />}
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/create-club");
              }}
            >
              Créer
            </Button>
          ) : null}
        </View>

        <View className="mb-3 flex-row rounded-2xl border border-border bg-bg-elevated p-1">
          <ModeTab active={mode === "live"} onPress={() => setModeSafe("live")} label="Clubs LIVE" />
          <ModeTab active={mode === "matchmaking"} onPress={() => setModeSafe("matchmaking")} label="Matchmaking" />
          <ModeTab active={mode === "directory"} onPress={() => setModeSafe("directory")} label="Annuaire" />
        </View>

        {mode === "live" ? (
          <>
            <LiveFilters
              value={filters}
              onChange={(next) => {
                setFilters(next);
                setRelaxed(false);
              }}
            />
            <Text className="mb-2 mt-3 text-xs font-semibold text-fg-muted">{liquidityLabel}</Text>
            <SmartMatchBanner visible={filtersEmpty && !relaxed} sessions={items} loading={isLoading} />
          </>
        ) : null}
      </View>

      {mode === "matchmaking" ? <ClubMatchmaking compact /> : null}
      {mode === "directory" ? <ClubsDirectory hideTitle /> : null}

      {mode === "live" ? (
        <FlatList
          style={{ flex: 1 }}
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#39ff8a" />}
          renderItem={({ item }) => <LiveClubCard item={item} reason={reasonBySession.get(item.id)} />}
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          ListEmptyComponent={
            <View style={{ flexGrow: 1, justifyContent: "center" }}>
              <LiveEmptyState
                isLoading={isLoading}
                isError={isError}
                onRetry={onRefresh}
                activeCount={activeLive.length}
                displayedCount={displayed.length}
                filtersEmpty={filtersEmpty}
                relaxed={relaxed}
                canWiden={canWiden}
                onWiden={widen}
                profilePosition={profile?.main_position ? POSITION_LABELS[profile.main_position] : null}
                profilePlatform={profile?.platform ? PLATFORM_LABELS[profile.platform] : null}
              />
            </View>
          }
        />
      ) : null}
    </View>
  );
}

function ModeTab({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-[44px] flex-1 justify-center rounded-xl px-2 py-2 ${active ? "bg-bg-card" : ""}`}
    >
      <Text className={`text-center text-[11px] font-bold ${active ? "text-fg" : "text-fg-muted"}`}>{label}</Text>
    </Pressable>
  );
}

function LiveEmptyState({
  isLoading,
  isError,
  onRetry,
  activeCount,
  displayedCount,
  filtersEmpty,
  relaxed,
  canWiden,
  onWiden,
  profilePosition,
  profilePlatform,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  activeCount: number;
  displayedCount: number;
  filtersEmpty: boolean;
  relaxed: boolean;
  canWiden: boolean;
  onWiden: () => void;
  profilePosition: string | null;
  profilePlatform: string | null;
}) {
  if (isLoading) {
    return (
      <View className="gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Impossible de charger les clubs LIVE." onRetry={onRetry} />;
  }

  if (displayedCount > 0) return null;

  if (activeCount === 0) {
    return (
      <View className="items-center rounded-2xl bg-bg-elevated px-5 py-10">
        <Text className="text-center text-base font-semibold text-fg">Aucun club LIVE pour l&apos;instant</Text>
        <Text className="mt-2 text-center text-sm text-fg-muted">
          Passe LIVE pour que les clubs te trouvent dès qu&apos;ils recrutent.
        </Text>
      </View>
    );
  }

  const profileHint =
    profilePosition && profilePlatform
      ? `Aucun club LIVE ne recherche ${profilePosition} sur ${profilePlatform} pour l'instant.`
      : "Aucun club LIVE ne correspond exactement à ton profil pour l'instant.";

  const title = !filtersEmpty
    ? "Pas de club LIVE pour ces critères."
    : !relaxed
      ? profileHint
      : "Aucun club LIVE pour l'instant";

  const subtitle = !filtersEmpty
    ? "On peut élargir : autre poste, plateforme ou niveau — toujours de vrais clubs LIVE, rien d'inventé."
    : "D'autres clubs LIVE recrutent peut-être sur un autre poste ou une autre plateforme.";

  return (
    <View className="items-center rounded-2xl bg-bg-elevated px-5 py-8">
      <Text className="text-center text-base font-semibold text-fg">{title}</Text>
      <Text className="mt-2 text-center text-sm text-fg-muted">{subtitle}</Text>
      {canWiden ? (
        <Pressable
          onPress={onWiden}
          className="mt-4 rounded-2xl bg-accent px-5 py-3 active:opacity-90"
          accessibilityRole="button"
        >
          <Text className="text-sm font-bold text-bg">Élargir la recherche</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

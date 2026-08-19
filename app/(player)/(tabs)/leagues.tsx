import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trophy } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { useActiveSeason, useSeasonStats } from "@/lib/hooks/useLeagues";

/** Ligues & Saisons — classements (section 3.F). */
export default function LeaguesScreen() {
  const { data: season, isLoading: seasonLoading, isError: seasonError, refetch: refetchSeason } = useActiveSeason();
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useSeasonStats(season?.id ?? null);

  const isLoading = seasonLoading || (Boolean(season) && statsLoading);
  const isError = seasonError || statsError;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View className="mb-4 flex-row items-center gap-2">
          <Trophy size={22} color="#39ff8a" />
          <Text className="font-display text-3xl text-fg">{season?.name ?? "Ligues"}</Text>
          {season && (
            <Badge tone="accent" className="ml-1">
              Active
            </Badge>
          )}
        </View>

        {isLoading ? (
          <View className="gap-3">
            <Skeleton className="h-56" />
            <Skeleton className="h-40" />
          </View>
        ) : isError ? (
          <ErrorState
            message="Impossible de charger les ligues."
            onRetry={() => {
              refetchSeason();
              refetchStats();
            }}
          />
        ) : !season ? (
          <EmptyState title="Aucune saison active pour le moment." />
        ) : !stats || stats.length === 0 ? (
          <EmptyState title="Aucune statistique pour cette saison pour l'instant." />
        ) : (
          <>
            <Card className="mb-4">
              <Text className="mb-3 font-display text-lg text-fg">Classement général</Text>
              {[...(stats ?? [])]
                .sort((a, b) => b.points - a.points)
                .slice(0, 20)
                .map((s, i) => (
                  <View key={s.id} className="mb-1.5 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 shrink">
                      <Text className="w-5 text-fg-subtle">{i + 1}</Text>
                      <Text numberOfLines={1} className="text-sm text-fg shrink">
                        {s.user?.username}
                      </Text>
                      <Badge tone="neutral">{`Div ${s.division}`}</Badge>
                    </View>
                    <Text className="text-sm font-extrabold text-fg">{s.points} pts</Text>
                  </View>
                ))}
            </Card>

            <View className="flex-row flex-wrap gap-3">
              <Leaderboard title="Buteurs" rows={rankBy(stats, "goals")} className="flex-1 min-w-[45%]" />
              <Leaderboard title="Passeurs" rows={rankBy(stats, "assists")} className="flex-1 min-w-[45%]" />
              <Leaderboard title="Gardiens (CS)" rows={rankBy(stats, "clean_sheets")} className="flex-1 min-w-[45%]" />
              <Leaderboard title="MVP" rows={rankBy(stats, "mvp_count")} className="flex-1 min-w-[45%]" />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function rankBy(stats: any[] | undefined, key: string) {
  return [...(stats ?? [])].sort((a, b) => b[key] - a[key]).slice(0, 5).map((s) => ({
    name: s.user?.username ?? "",
    value: s[key] as number,
  }));
}

function Leaderboard({ title, rows, className }: { title: string; rows: { name: string; value: number }[]; className?: string }) {
  return (
    <Card className={className}>
      <Text className="mb-2 text-xs font-extrabold uppercase tracking-wide text-fg-muted">{title}</Text>
      {rows.map((r, i) => (
        <View key={i} className="mb-1 flex-row justify-between">
          <Text numberOfLines={1} className="flex-1 text-sm text-fg">
            {i + 1}. {r.name}
          </Text>
          <Text className="text-sm font-bold text-accent">{r.value}</Text>
        </View>
      ))}
    </Card>
  );
}

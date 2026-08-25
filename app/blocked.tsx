import { Text, View } from "react-native";
import { Screen, EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PlayerCard } from "@/components/player/PlayerCard";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyBlocks, useMyReports, useUnblockUser } from "@/lib/hooks/useSafety";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/safety";
import { buildPlayerCardData } from "@/lib/playerCard";
import { toast } from "@/lib/toast";
import { timeAgo } from "@/lib/utils";

export default function BlockedScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: blocks, isLoading, isError, refetch } = useMyBlocks(userId);
  const { data: reports, isLoading: reportsLoading, isError: reportsError, refetch: refetchReports } = useMyReports(userId);
  const unblock = useUnblockUser();

  return (
    <Screen>
      <Text className="mb-4 font-display text-2xl text-fg">Bloqués & signalements</Text>

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Joueurs bloqués</Text>
      {isLoading ? (
        <View className="mb-6 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </View>
      ) : isError ? (
        <View className="mb-6">
          <ErrorState message="Impossible de charger tes blocages." onRetry={refetch} />
        </View>
      ) : !blocks || blocks.length === 0 ? (
        <View className="mb-6">
          <EmptyState title="Tu n'as bloqué personne." subtitle="Un blocage masque l'autre joueur du LIVE, du matching, des invitations et des messages." />
        </View>
      ) : (
        <View className="mb-6 gap-2">
          {blocks.map((row) => {
            const unblockButton = (
              <Button
                variant="secondary"
                size="sm"
                loading={unblock.isPending}
                onPress={() =>
                  unblock.mutate(row.blocked_id, {
                    onSuccess: () => toast.success("Joueur débloqué."),
                    onError: (err: any) => toast.error(err.message ?? "Impossible de débloquer."),
                  })
                }
              >
                Débloquer
              </Button>
            );
            const footer = <Text className="mt-1 text-xs text-fg-subtle">Bloqué {timeAgo(row.created_at)}</Text>;
            if (!row.blocked) {
              return (
                <View key={row.id} className="flex-row items-center justify-between rounded-2xl border border-border bg-bg-card p-3">
                  <View className="flex-1 pr-2">
                    <Text className="font-bold text-fg-muted">Joueur</Text>
                    {footer}
                  </View>
                  {unblockButton}
                </View>
              );
            }
            return (
              <PlayerCard
                key={row.id}
                data={buildPlayerCardData(row.blocked)}
                variant="mini"
                rightSlot={unblockButton}
                footer={footer}
              />
            );
          })}
        </View>
      )}

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Mes signalements</Text>
      {reportsLoading ? (
        <Skeleton className="h-16" />
      ) : reportsError ? (
        <ErrorState message="Impossible de charger tes signalements." onRetry={refetchReports} />
      ) : !reports || reports.length === 0 ? (
        <EmptyState title="Aucun signalement envoyé." subtitle="Un signalement reste ouvert pour la modération jusqu'à revue." />
      ) : (
        <View className="gap-2">
          {reports.map((row) => {
            const statusBadge = (
              <Badge tone={row.status === "OPEN" ? "warn" : "neutral"}>
                {row.status === "OPEN" ? "Ouvert" : row.status === "REVIEWED" ? "Revu" : "Classé"}
              </Badge>
            );
            const footer = (
              <View className="mt-1 gap-1">
                <Text className="text-sm text-fg-muted">
                  {REPORT_REASON_LABELS[row.reason as ReportReason] ?? row.reason}
                </Text>
                {row.details ? <Text className="text-xs text-fg-subtle">{row.details}</Text> : null}
                <Text className="text-xs text-fg-subtle">{timeAgo(row.created_at)}</Text>
              </View>
            );
            if (!row.reported) {
              return (
                <View key={row.id} className="rounded-2xl border border-border bg-bg-card p-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-fg-muted">Joueur</Text>
                    {statusBadge}
                  </View>
                  {footer}
                </View>
              );
            }
            return (
              <PlayerCard
                key={row.id}
                data={buildPlayerCardData(row.reported)}
                variant="mini"
                rightSlot={statusBadge}
                footer={footer}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

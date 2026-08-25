import { Text, View } from "react-native";
import { LogOut } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { PlayerCard } from "@/components/player/PlayerCard";
import { DepartureCountdown } from "@/components/club/DepartureCountdown";
import { useClubDepartures, useRespondDeparture } from "@/lib/hooks/useDepartures";
import { buildPlayerCardData } from "@/lib/playerCard";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { ClubMemberRow } from "@/lib/types";

/**
 * Demandes de départ en attente (Phase 5, Étape 4) — owner/manager only,
 * rendu par le parent (app/(club)/(tabs)/effectif.tsx) déjà gated `canManage`. Les 3 actions
 * (NOW/NEXT_MATCH/REFUSE) passent exclusivement par respond-departure ; le
 * compteur de strikes (unifié refus+timeout) et un éventuel FORCE_EXIT au 3e
 * strike sont entièrement déterminés côté serveur — jamais recalculés ici.
 */
export function DeparturesPanel({ clubId, members }: { clubId: string; members: ClubMemberRow[] }) {
  const { data: departures, isLoading, isError, refetch } = useClubDepartures(clubId);
  const respond = useRespondDeparture(clubId);

  const act = (departureId: string, decision: "NOW" | "NEXT_MATCH" | "REFUSE") => {
    respond.mutate(
      { departureId, decision },
      {
        onSuccess: () => {
          const labels = { NOW: "Joueur libéré immédiatement.", NEXT_MATCH: "Libération programmée après le prochain match.", REFUSE: "Demande refusée." };
          toast.success(labels[decision]);
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<LogOut size={18} color="#f4f5f7" />}>Demandes de départ</CardTitle>
        <Text className="text-sm text-fg-muted">{departures?.length ?? 0} en attente</Text>
      </CardHeader>

      {isLoading ? (
        <Skeleton className="h-20" />
      ) : isError ? (
        <ErrorState message="Impossible de charger les demandes de départ." onRetry={refetch} />
      ) : !departures || departures.length === 0 ? (
        <Text className="text-sm text-fg-muted">Aucune demande de départ en attente.</Text>
      ) : (
        <View className="gap-2">
          {departures.map((d) => {
            const strikeCount = members.find((m) => m.user_id === d.user_id)?.strike_count ?? 0;
            const countdown = d.expires_at ? <DepartureCountdown expiresAt={d.expires_at} /> : null;
            const footer = (
              <View className="mt-2 gap-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-fg-subtle">Demandé {timeAgo(d.requested_at)}</Text>
                  {strikeCount > 0 ? <Badge tone="warn">{`${strikeCount} strike(s)`}</Badge> : null}
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  <Button size="sm" onPress={() => act(d.id, "NOW")} loading={respond.isPending}>
                    Libérer maintenant
                  </Button>
                  <Button size="sm" variant="secondary" onPress={() => act(d.id, "NEXT_MATCH")} loading={respond.isPending}>
                    Après le prochain match
                  </Button>
                  <Button size="sm" variant="danger" onPress={() => act(d.id, "REFUSE")} loading={respond.isPending}>
                    Refuser
                  </Button>
                </View>
              </View>
            );
            if (!d.user) {
              return (
                <View key={d.id} className="gap-2 rounded-xl border border-border bg-bg-elevated p-3">
                  <View className="flex-row items-center justify-between">
                    <Text numberOfLines={1} className="shrink font-bold text-fg-muted">
                      Joueur
                    </Text>
                    {countdown}
                  </View>
                  {footer}
                </View>
              );
            }
            return (
              <PlayerCard
                key={d.id}
                data={buildPlayerCardData(d.user)}
                variant="mini"
                rightSlot={countdown}
                footer={footer}
              />
            );
          })}
        </View>
      )}
    </Card>
  );
}

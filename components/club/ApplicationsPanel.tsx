import { useState } from "react";
import { Text, View } from "react-native";
import { Check, Inbox, X } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PlayerCard } from "@/components/player/PlayerCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { buildPlayerCardData } from "@/lib/playerCard";
import { timeAgo } from "@/lib/utils";
import { useApplications, useRespondApplication } from "@/lib/hooks/useApplications";
import { useBlockedUserIds } from "@/lib/hooks/useSafety";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";

/** Candidatures entrantes — MINI Player Card + accepter/refuser. */
export function ApplicationsPanel({ clubId }: { clubId: string }) {
  const { session } = useAuth();
  const { data: applications, isLoading, isError, refetch } = useApplications(clubId);
  const { data: blockedIds } = useBlockedUserIds(session?.user.id ?? null);
  const respond = useRespondApplication(clubId);

  const blocked = new Set(blockedIds ?? []);
  const pending = (applications ?? []).filter((a) => a.status === "PENDING" && !blocked.has(a.user_id));
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingStatus, setActingStatus] = useState<"ACCEPTED" | "DECLINED" | null>(null);

  const act = (applicationId: string, status: "ACCEPTED" | "DECLINED") => {
    if (actingId || respond.isPending) return;
    setActingId(applicationId);
    setActingStatus(status);
    respond.mutate(
      { applicationId, status },
      {
        onSuccess: () => toast.success(status === "ACCEPTED" ? "Candidat accepté." : "Candidature refusée."),
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
        onSettled: () => {
          setActingId(null);
          setActingStatus(null);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Inbox size={18} color="#f4f5f7" />}>Candidatures</CardTitle>
        <Text className="text-sm text-fg-muted">{pending.length} en attente</Text>
      </CardHeader>

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : isError ? (
        <ErrorState message="Impossible de charger les candidatures." onRetry={refetch} />
      ) : pending.length === 0 ? (
        <Text className="text-sm text-fg-muted">Aucune candidature en attente.</Text>
      ) : (
        <View className="gap-2">
          {pending.map((app) => {
            const actions = (
              <View className="mt-2 gap-1">
                <Text className="text-[11px] text-fg-subtle">{timeAgo(app.created_at)}</Text>
                {app.message ? (
                  <Text numberOfLines={1} className="text-sm text-fg-muted">
                    &quot;{app.message}&quot;
                  </Text>
                ) : null}
                <View className="flex-row gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={actingId === app.id && actingStatus === "ACCEPTED"}
                    disabled={Boolean(actingId)}
                    onPress={() => act(app.id, "ACCEPTED")}
                    icon={<Check size={16} color="#39ff8a" />}
                    className="min-h-[44px] flex-1 px-2.5"
                    accessibilityLabel="Accepter"
                  >
                    Accepter
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={actingId === app.id && actingStatus === "DECLINED"}
                    disabled={Boolean(actingId)}
                    onPress={() => act(app.id, "DECLINED")}
                    icon={<X size={16} color="#ff4d4f" />}
                    className="min-h-[44px] flex-1 px-2.5"
                    accessibilityLabel="Refuser"
                  >
                    Refuser
                  </Button>
                </View>
              </View>
            );

            if (!app.user) {
              return (
                <View key={app.id} className="rounded-2xl border border-border bg-bg-elevated p-3">
                  <Text className="font-semibold text-fg-muted">Joueur</Text>
                  {actions}
                </View>
              );
            }

            return (
              <PlayerCard
                key={app.id}
                data={buildPlayerCardData(app.user, { needPositions: app.position })}
                variant="mini"
                footer={actions}
              />
            );
          })}
        </View>
      )}
    </Card>
  );
}

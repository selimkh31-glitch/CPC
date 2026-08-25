import { useState } from "react";
import { Text, View } from "react-native";
import { Check, Inbox, X } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { POSITION_LABELS } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { useApplications, useRespondApplication } from "@/lib/hooks/useApplications";
import { useBlockedUserIds } from "@/lib/hooks/useSafety";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";

/** Candidatures entrantes en temps réel, triées par fiabilité (section 3.B/D). */
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
          {pending.map((app) => (
            <View key={app.id} className="flex-row items-center justify-between gap-2 rounded-xl border border-border bg-bg-elevated p-3">
              <View className="shrink flex-1">
                <View className="flex-row items-center gap-2">
                  <Text numberOfLines={1} className="shrink font-bold text-fg">
                    {app.user?.username ?? "Joueur"}
                  </Text>
                  <Badge tone="accent">{`${Math.round(app.user?.reliability_score ?? 0)} fiab.`}</Badge>
                </View>
                <Text className="mt-0.5 text-xs text-fg-muted">
                  {POSITION_LABELS[app.position]}
                  {app.slot_id ? ` (${app.slot_id})` : ""} · {timeAgo(app.created_at)}
                </Text>
                {app.message && (
                  <Text numberOfLines={1} className="mt-1 text-sm text-fg-muted">
                    &quot;{app.message}&quot;
                  </Text>
                )}
              </View>
              <View className="flex-row gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={actingId === app.id && actingStatus === "ACCEPTED"}
                  disabled={Boolean(actingId)}
                  onPress={() => act(app.id, "ACCEPTED")}
                  icon={<Check size={16} color="#39ff8a" />}
                  className="min-h-[44px] px-2.5"
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
                  className="min-h-[44px] px-2.5"
                  accessibilityLabel="Refuser"
                >
                  Refuser
                </Button>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { POSITION_LABELS } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { useMyApplications, useWithdrawApplication, useMyApplicationStatusUpdates } from "@/lib/hooks/useApplications";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";
import type { ApplicationStatus } from "@/lib/types";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  WITHDRAWN: "Retirée",
};

const STATUS_TONES: Record<ApplicationStatus, "warn" | "accent" | "danger" | "neutral"> = {
  PENDING: "warn",
  ACCEPTED: "accent",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

/** Suivi des candidatures du joueur connecté — voir la conception "Mes candidatures" (section 5 du workflow LIVE). */
export default function MyApplicationsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: applications, isLoading, isError, refetch } = useMyApplications(userId);
  const withdraw = useWithdrawApplication();

  const onStatusChange = useCallback((status: string) => {
    if (status === "ACCEPTED") toast.success("Une de tes candidatures a été acceptée !");
    if (status === "REJECTED") toast.info("Une de tes candidatures a été refusée.");
  }, []);
  useMyApplicationStatusUpdates(userId, onStatusChange);

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </ScrollView>
    );
  }

  if (isError) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <ErrorState message="Impossible de charger tes candidatures." onRetry={refetch} />
      </ScrollView>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title="Tu n'as encore postulé à aucune session." />
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}>
      {applications.map((app) => (
        <Card key={app.id}>
          <View className="flex-row items-center justify-between gap-2">
            <Text numberOfLines={1} className="shrink font-display text-lg text-fg">
              {app.club?.name ?? "Club"}
            </Text>
            <Badge tone={STATUS_TONES[app.status]}>{STATUS_LABELS[app.status]}</Badge>
          </View>
          <Text className="mt-1 text-xs text-fg-muted">
            {POSITION_LABELS[app.position]} · {timeAgo(app.created_at)}
          </Text>
          {app.message && (
            <Text numberOfLines={2} className="mt-2 text-sm text-fg-muted">
              &quot;{app.message}&quot;
            </Text>
          )}
          {app.status === "PENDING" && (
            <Button
              variant="secondary"
              className="mt-3"
              loading={withdraw.isPending}
              onPress={() =>
                withdraw.mutate(app.id, {
                  onSuccess: () => toast.info("Candidature retirée."),
                  onError: (err: any) => toast.error(err.message ?? "Erreur"),
                })
              }
            >
              Retirer ma candidature
            </Button>
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

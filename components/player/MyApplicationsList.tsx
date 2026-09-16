import { useCallback } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { ClubCard } from "@/components/club/ClubCard";
import { POSITION_LABELS } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { buildClubCardData } from "@/lib/clubCard";
import { useMyApplications, useWithdrawApplication, useMyApplicationStatusUpdates } from "@/lib/hooks/useApplications";
import { useAuth } from "@/lib/providers/AuthProvider";
import { clubRankingRowHref } from "@/lib/rankings";
import { toast } from "@/lib/toast";
import { tournamentClubDisplayName } from "@/lib/tournaments";
import type { ApplicationStatus } from "@/lib/types";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  DECLINED: "Refusée",
  WITHDRAWN: "Retirée",
  CANCELLED: "Annulée",
  EXPIRED: "Expirée",
};

const STATUS_TONES: Record<ApplicationStatus, "warn" | "accent" | "danger" | "neutral"> = {
  PENDING: "warn",
  ACCEPTED: "accent",
  REJECTED: "danger",
  DECLINED: "danger",
  WITHDRAWN: "neutral",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

/** Liste des candidatures du joueur — extraite de app/my-applications.tsx pour l'onglet Activité. */
export function MyApplicationsList() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: applications, isLoading, isError, refetch } = useMyApplications(userId);
  const withdraw = useWithdrawApplication();

  const onStatusChange = useCallback((status: string) => {
    if (status === "ACCEPTED") toast.success("Un club t'a dit oui.");
    if (status === "REJECTED" || status === "DECLINED") toast.info("Un club a dit non.");
    if (status === "EXPIRED") toast.info("Trop tard — c'est fini.");
    if (status === "CANCELLED") toast.info("Le club n'est plus en LIVE.");
  }, []);
  useMyApplicationStatusUpdates(userId, onStatusChange);

  if (isLoading) {
    return (
      <View className="gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Impossible de charger tes demandes." onRetry={refetch} />;
  }

  if (!applications || applications.length === 0) {
    return (
      <EmptyState
        title="Tu n'as encore postulé nulle part."
        subtitle="Passe par LIVE pour trouver un club et postuler."
      />
    );
  }

  return (
    <View className="gap-3">
      {applications.map((app) => {
        const display = tournamentClubDisplayName(app.club?.name);
        const href = display ? clubRankingRowHref(app.club_id, display) : null;
        const rightSlot = <Badge tone={STATUS_TONES[app.status]}>{STATUS_LABELS[app.status]}</Badge>;
        const footer = (
          <View className="mt-1">
            <Text className="text-xs text-fg-muted">
              {POSITION_LABELS[app.position]} · {timeAgo(app.created_at)}
            </Text>
            {app.message ? (
              <Text numberOfLines={2} className="mt-1 text-sm text-fg-muted">
                &quot;{app.message}&quot;
              </Text>
            ) : null}
            {app.status === "PENDING" ? (
              <Button
                variant="ghost"
                className="mt-3 min-h-[44px]"
                loading={withdraw.isPending && withdraw.variables === app.id}
                disabled={withdraw.isPending}
                onPress={() => {
                  if (withdraw.isPending) return;
                  withdraw.mutate(app.id, {
                    onSuccess: () => toast.info("C'est retiré."),
                    onError: (err: any) => toast.error(err.message ?? "Erreur"),
                  });
                }}
              >
                Retirer
              </Button>
            ) : null}
          </View>
        );
        if (!display) {
          return (
            <View key={app.id} className="border border-accent/30 bg-bg-card px-3 py-2">
              <View className="min-h-[44px] flex-row items-center justify-end">{rightSlot}</View>
              {footer}
            </View>
          );
        }
        return (
          <ClubCard
            key={app.id}
            data={buildClubCardData({ ...(app.club ?? { id: app.club_id }), id: app.club_id, name: display })}
            variant="mini"
            interactive={Boolean(href)}
            onPress={href ? () => router.push(href) : undefined}
            rightSlot={rightSlot}
            footer={footer}
          />
        );
      })}
    </View>
  );
}

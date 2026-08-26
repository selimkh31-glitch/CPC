import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Send } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayerCard } from "@/components/player/PlayerCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { buildPlayerCardData } from "@/lib/playerCard";
import { timeAgo } from "@/lib/utils";
import { useCancelInvitation, useClubInvitations } from "@/lib/hooks/useInvitations";
import { toast } from "@/lib/toast";
import type { InvitationStatus } from "@/lib/types";

const STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  DECLINED: "Refusée",
  CANCELLED: "Annulée",
  RESERVED: "Réservée",
  EXPIRED: "Expirée",
};

const STATUS_TONES: Record<InvitationStatus, "warn" | "accent" | "danger" | "neutral"> = {
  PENDING: "warn",
  ACCEPTED: "accent",
  DECLINED: "danger",
  CANCELLED: "neutral",
  RESERVED: "neutral",
  EXPIRED: "neutral",
};

/**
 * Invitations CLUB envoyées — MINI Player Card du joueur invité.
 * Filtre `slot_id === null` (pas les invitations MATCH).
 */
export function ClubInvitationsPanel({ clubId }: { clubId: string }) {
  const { data: allInvitations, isLoading, isError, error, refetch } = useClubInvitations(clubId);
  const invitations = useMemo(() => allInvitations?.filter((inv) => inv.slot_id === null), [allInvitations]);
  const cancelInvitation = useCancelInvitation(clubId);
  const [actingId, setActingId] = useState<string | null>(null);

  const cancel = (invitationId: string) => {
    if (actingId || cancelInvitation.isPending) return;
    setActingId(invitationId);
    cancelInvitation.mutate(
      { invitationId },
      {
        onSuccess: () => toast.success("Invitation annulée."),
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible d'annuler."),
        onSettled: () => setActingId(null),
      }
    );
  };

  return (
    <Card className="p-3">
      <CardHeader className="mb-2">
        <CardTitle icon={<Send size={16} color="#9aa0a8" />} className="text-[13px] font-medium normal-case tracking-normal text-fg-muted">
          Invitations envoyées
        </CardTitle>
        <Text className="text-[12px] text-fg-subtle">{invitations?.length ?? 0}</Text>
      </CardHeader>

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : isError ? (
        <ErrorState
          message={__DEV__ && error instanceof Error ? error.message : "Impossible de charger les invitations."}
          onRetry={refetch}
        />
      ) : !invitations || invitations.length === 0 ? (
        <Text className="text-sm text-fg-muted">Aucune invitation envoyée. Cherche un joueur ci-dessus.</Text>
      ) : (
        <View className="gap-2">
          {invitations.map((inv) => {
            const statusBadge = <Badge tone={STATUS_TONES[inv.status]}>{STATUS_LABELS[inv.status]}</Badge>;
            const footer = (
              <View className="mt-1 flex-row items-center justify-between gap-2">
                <Text className="text-[11px] text-fg-subtle">Invitation au club · {timeAgo(inv.created_at)}</Text>
                {inv.status === "PENDING" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={actingId === inv.id}
                    disabled={Boolean(actingId)}
                    onPress={() => cancel(inv.id)}
                    className="min-h-[44px] self-end px-2"
                    accessibilityLabel="Annuler l'invitation"
                  >
                    Annuler
                  </Button>
                ) : null}
              </View>
            );
            if (!inv.user) {
              return (
                <View key={inv.id} className="flex-row items-center justify-between gap-2 rounded-xl border border-border bg-bg-elevated p-3">
                  <View className="shrink flex-1">
                    <Text numberOfLines={1} className="font-bold text-fg">
                      Joueur
                    </Text>
                    {footer}
                  </View>
                  {statusBadge}
                </View>
              );
            }
            return (
              <PlayerCard
                key={inv.id}
                data={buildPlayerCardData(inv.user)}
                variant="mini"
                rightSlot={statusBadge}
                footer={footer}
              />
            );
          })}
        </View>
      )}
    </Card>
  );
}

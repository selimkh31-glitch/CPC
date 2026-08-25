import { Text, View } from "react-native";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { ClubCard } from "@/components/club/ClubCard";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { FORMATIONS, type FormationId } from "@/lib/formations";
import { timeAgo } from "@/lib/utils";
import { buildClubCardData } from "@/lib/clubCard";
import { useMyInvitations, useRespondInvitation, useRespondTransitionInvitation } from "@/lib/hooks/useInvitations";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";
import type { InvitationStatus } from "@/lib/types";

const STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  DECLINED: "Refusée",
  CANCELLED: "Annulée",
  RESERVED: "Réservé",
  EXPIRED: "Expirée",
};

const STATUS_TONES: Record<InvitationStatus, "warn" | "accent" | "danger" | "neutral" | "pro"> = {
  PENDING: "warn",
  ACCEPTED: "accent",
  DECLINED: "danger",
  CANCELLED: "neutral",
  RESERVED: "pro",
  EXPIRED: "neutral",
};

function inviteLabel(slotId: string | null, formationId: string | null): string {
  if (slotId === null) return "Invitation au club";
  const formation = formationId ? FORMATIONS[formationId as FormationId] : undefined;
  const position = formation?.find((s) => s.slotId === slotId)?.position as PositionCode | undefined;
  return `Invitation pour un match · ${position ? POSITION_LABELS[position] : slotId}`;
}

/** Liste des invitations reçues — extraite de app/my-invitations.tsx pour l'onglet Activité. */
export function MyInvitationsList() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: invitations, isLoading, isError, refetch } = useMyInvitations(userId);
  const respond = useRespondInvitation(userId);
  const respondTransition = useRespondTransitionInvitation(userId);

  if (isLoading) {
    return (
      <View className="gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Impossible de charger tes invitations." onRetry={refetch} />;
  }

  if (!invitations || invitations.length === 0) {
    return <EmptyState title="Tu n'as reçu aucune invitation pour l'instant." />;
  }

  const act = (invitationId: string, status: "ACCEPTED" | "DECLINED", isTransition: boolean) => {
    const mutation = isTransition ? respondTransition : respond;
    mutation.mutate(
      { invitationId, status },
      {
        onSuccess: () =>
          toast.success(
            status === "ACCEPTED" ? (isTransition ? "Place réservée !" : "Invitation acceptée !") : "Invitation refusée."
          ),
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  return (
    <View className="gap-3">
      {invitations.map((inv) => {
        const isTransition = Boolean(inv.departure_request_id);
        const pending = isTransition ? respondTransition.isPending : respond.isPending;
        return (
          <ClubCard
            key={inv.id}
            data={buildClubCardData(inv.club ?? { id: inv.club_id, name: "Club" })}
            variant="mini"
            rightSlot={
              <View className="flex-row items-center gap-1.5">
                {isTransition ? <Badge tone="pro">Transition</Badge> : null}
                <Badge tone={STATUS_TONES[inv.status]}>{STATUS_LABELS[inv.status]}</Badge>
              </View>
            }
            footer={
              <View className="mt-1">
                <Text className="text-xs text-fg-muted">
                  {inviteLabel(inv.slot_id, inv.club?.formation ?? null)} · {timeAgo(inv.created_at)}
                </Text>
                {inv.status === "RESERVED" ? (
                  <Text className="mt-3 text-sm text-fg-muted">
                    Réservé pour ce club — tu restes membre de ton club actuel jusqu&apos;à ta libération effective (après
                    ton prochain match validé).
                  </Text>
                ) : null}
                {inv.status === "PENDING" ? (
                  <View className="mt-3 flex-row gap-2">
                    <Button variant="secondary" className="flex-1" loading={pending} onPress={() => act(inv.id, "DECLINED", isTransition)}>
                      Refuser
                    </Button>
                    <Button className="flex-1" loading={pending} onPress={() => act(inv.id, "ACCEPTED", isTransition)}>
                      {isTransition ? "Réserver ma place" : "Accepter"}
                    </Button>
                  </View>
                ) : null}
              </View>
            }
          />
        );
      })}
    </View>
  );
}

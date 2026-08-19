import { ScrollView, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { FORMATIONS, type FormationId } from "@/lib/formations";
import { timeAgo } from "@/lib/utils";
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
};

const STATUS_TONES: Record<InvitationStatus, "warn" | "accent" | "danger" | "neutral" | "pro"> = {
  PENDING: "warn",
  ACCEPTED: "accent",
  DECLINED: "danger",
  CANCELLED: "neutral",
  RESERVED: "pro",
};

/**
 * Invitations reçues par le joueur connecté (phase 4) — miroir de "Mes
 * candidatures". Phase 5, Étape 5 : une invitation portant `departure_request_id`
 * est une offre de TRANSITION — son acceptation passe par
 * respond-transition-invitation (PENDING -> RESERVED, jamais ACCEPTED direct)
 * au lieu de respond-invitation. Le statut RESERVED n'a plus d'action : le
 * joueur reste membre de son club actuel jusqu'à la finalisation côté
 * serveur (launch-match-checkin, non recréé ici).
 *
 * Distinction CLUB/MATCH (audit "invitations sortantes") — `slot_id` reste la
 * seule source de vérité (null = invitation générale au club, non-null =
 * invitation pour un slot précis de la feuille de match). Ce label est
 * purement informatif côté joueur : `respond-invitation`/`accept_invitation()`
 * (jamais touchés ici) traitent déjà les deux cas correctement (membership
 * seul si `slot_id` est null, + slot_assignment sinon).
 */
function inviteLabel(slotId: string | null, formationId: string | null): string {
  if (slotId === null) return "Invitation au club";
  const formation = formationId ? FORMATIONS[formationId as FormationId] : undefined;
  const position = formation?.find((s) => s.slotId === slotId)?.position as PositionCode | undefined;
  return `Invitation pour un match · ${position ? POSITION_LABELS[position] : slotId}`;
}
export default function MyInvitationsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: invitations, isLoading, isError, refetch } = useMyInvitations(userId);
  const respond = useRespondInvitation(userId);
  const respondTransition = useRespondTransitionInvitation(userId);

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
        <ErrorState message="Impossible de charger tes invitations." onRetry={refetch} />
      </ScrollView>
    );
  }

  if (!invitations || invitations.length === 0) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title="Tu n'as reçu aucune invitation pour l'instant." />
      </ScrollView>
    );
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
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}>
      {invitations.map((inv) => {
        const isTransition = Boolean(inv.departure_request_id);
        const pending = isTransition ? respondTransition.isPending : respond.isPending;
        return (
          <Card key={inv.id}>
            <View className="flex-row items-center justify-between gap-2">
              <View className="shrink flex-1 flex-row items-center gap-1.5">
                <Text numberOfLines={1} className="shrink font-display text-lg text-fg">
                  {inv.club?.name ?? "Club"}
                </Text>
                {isTransition && <Badge tone="pro">Transition</Badge>}
              </View>
              <Badge tone={STATUS_TONES[inv.status]}>{STATUS_LABELS[inv.status]}</Badge>
            </View>
            <Text className="mt-1 text-xs text-fg-muted">
              {inviteLabel(inv.slot_id, inv.club?.formation ?? null)} · {timeAgo(inv.created_at)}
            </Text>

            {inv.status === "RESERVED" && (
              <Text className="mt-3 text-sm text-fg-muted">
                Réservé pour ce club — tu restes membre de ton club actuel jusqu'à ta libération effective (après ton
                prochain match validé).
              </Text>
            )}

            {inv.status === "PENDING" && (
              <View className="mt-3 flex-row gap-2">
                <Button variant="secondary" className="flex-1" loading={pending} onPress={() => act(inv.id, "DECLINED", isTransition)}>
                  Refuser
                </Button>
                <Button className="flex-1" loading={pending} onPress={() => act(inv.id, "ACCEPTED", isTransition)}>
                  {isTransition ? "Réserver ma place" : "Accepter"}
                </Button>
              </View>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

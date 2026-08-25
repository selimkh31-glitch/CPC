import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { DoorOpen, Clock, ArrowRightCircle } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { DepartureCountdown } from "@/components/club/DepartureCountdown";
import { useDeparture, useRequestDeparture, useMyDepartureUpdates } from "@/lib/hooks/useDepartures";
import { toast } from "@/lib/toast";
import type { ClubMemberRow, DepartureStatus } from "@/lib/types";

/**
 * Carte joueur — engagement/départ (Phase 5, Étape 4). Rendue par le parent
 * uniquement pour MEMBER/MANAGER (jamais OWNER, section 9 — pas de
 * re-vérification de rôle ici, même convention que FormationSelector/
 * MatchCheckinPanel). Aucune écriture directe : la demande passe par
 * request-departure (useRequestDeparture) ; le statut affiché vient
 * uniquement de club_departures, lu en lecture seule (RLS
 * club_departures_select_involved).
 */
export function MyDepartureStatusCard({
  clubId,
  userId,
  membership,
}: {
  clubId: string;
  userId: string;
  membership: ClubMemberRow;
}) {
  const { data: departure, isLoading } = useDeparture(membership.active_departure_request_id);
  const [confirming, setConfirming] = useState(false);
  const requestDeparture = useRequestDeparture(clubId);

  const onStatusChange = useCallback((status: DepartureStatus) => {
    const messages: Partial<Record<DepartureStatus, string>> = {
      ACCEPTED_NOW: "Ton départ a été accepté — tu es libre !",
      ACCEPTED_NEXT_MATCH: "Ton départ est programmé après le prochain match.",
      REFUSED: "Ta demande de départ a été refusée.",
      EXPIRED: "Ta demande de départ a expiré sans réponse.",
      FORCE_EXIT: "Départ forcé par le système (3 refus/non-réponses cumulés) — tu es libre.",
    };
    const msg = messages[status];
    if (msg) toast.info(msg);
  }, []);
  useMyDepartureUpdates(userId, onStatusChange);

  const confirmAndRequest = () => {
    if (requestDeparture.isPending) return;
    requestDeparture.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        toast.success("Demande de départ envoyée.");
      },
      onError: (err: any) => toast.error(err.message ?? "Impossible d'envoyer la demande de départ."),
    });
  };

  // Demande active — affiche le statut résolu côté serveur, aucune logique recréée ici.
  if (membership.active_departure_request_id) {
    if (isLoading || !departure) {
      return (
        <Card>
          <Skeleton className="h-16" />
        </Card>
      );
    }

    if (departure.status === "PENDING") {
      return (
        <Card>
          <CardHeader>
            <CardTitle icon={<Clock size={18} color="#f4f5f7" />}>Demande de départ en cours</CardTitle>
          </CardHeader>
          <View className="gap-2">
            {departure.expires_at && <DepartureCountdown expiresAt={departure.expires_at} />}
            {membership.strike_count > 0 && (
              <Badge tone="warn">{`${membership.strike_count} strike(s) déjà cumulé(s)`}</Badge>
            )}
            <Text className="text-sm text-fg-muted">
              Tu restes membre du club et peux continuer à jouer normalement en attendant la réponse.
            </Text>
          </View>
        </Card>
      );
    }

    if (departure.status === "ACCEPTED_NEXT_MATCH") {
      const targetName = departure.transition_target_club?.name;
      return (
        <Card>
          <CardHeader>
            <CardTitle icon={<ArrowRightCircle size={18} color="#39ff8a" />}>
              {targetName ? "En transition" : "Libération après le prochain match"}
            </CardTitle>
          </CardHeader>
          <View className="gap-2">
            {targetName && <Badge tone="pro">{`Réservé pour ${targetName}`}</Badge>}
            <Text className="text-sm text-fg-muted">
              {targetName
                ? `Tu restes membre de ton club actuel et joues normalement le prochain match — il validera ta libération et ta place chez ${targetName} sera finalisée.`
                : "Tu restes membre et joues normalement le prochain match — il validera ta libération. Tu peux déjà être visible et invité par d'autres clubs."}
            </Text>
          </View>
        </Card>
      );
    }

    // États transitoires (rarement observés côté client : la ligne membership
    // disparaît ou le pointeur se libère dès que le serveur les atteint).
    return (
      <Card>
        <Text className="text-sm text-fg-muted">Ta demande a été traitée.</Text>
      </Card>
    );
  }

  // Aucune demande active.
  if (membership.matches_played_count < 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle icon={<DoorOpen size={18} color="#f4f5f7" />}>Quitter le club</CardTitle>
        </CardHeader>
        <Text className="text-sm text-fg-muted">
          Tu dois avoir joué au moins 1 match validé (check-in) dans ce club avant de pouvoir demander ton départ.
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<DoorOpen size={18} color="#f4f5f7" />}>Quitter le club</CardTitle>
      </CardHeader>
      <Text className="mb-3 text-sm text-fg-muted">
        {membership.matches_played_count} match{membership.matches_played_count > 1 ? "s" : ""} joué — départ
        disponible.
      </Text>
      {confirming ? (
        <View className="gap-2">
          <Text className="text-sm text-fg-muted">
            L&apos;owner/manager aura 3 minutes pour répondre. Tu restes membre et tu peux continuer à jouer pendant ce
            temps — aucune pénalité.
          </Text>
          <Button variant="danger" loading={requestDeparture.isPending} onPress={confirmAndRequest}>
            Confirmer
          </Button>
          <Button variant="secondary" disabled={requestDeparture.isPending} onPress={() => setConfirming(false)}>
            Annuler
          </Button>
        </View>
      ) : (
        <Button variant="danger" onPress={() => setConfirming(true)}>
          Quitter le club
        </Button>
      )}
    </Card>
  );
}

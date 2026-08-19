import { useMemo } from "react";
import { Text, View } from "react-native";
import { Send } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { timeAgo } from "@/lib/utils";
import { useClubInvitations } from "@/lib/hooks/useInvitations";
import type { InvitationStatus } from "@/lib/types";

const STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  DECLINED: "Refusée",
  CANCELLED: "Annulée",
  RESERVED: "Réservée",
};

const STATUS_TONES: Record<InvitationStatus, "warn" | "accent" | "danger" | "neutral"> = {
  PENDING: "warn",
  ACCEPTED: "accent",
  DECLINED: "danger",
  CANCELLED: "neutral",
  RESERVED: "neutral",
};

/**
 * Invitations CLUB envoyées par ce club (rejoindre le club, `slot_id: null`),
 * TOUS statuts confondus — lecture seule, `useClubInvitations`
 * (lib/hooks/useInvitations.ts, élargi à l'historique complet + fix ambiguïté
 * FK `users`, voir son docstring). Filtre explicitement `slot_id === null` :
 * les invitations MATCH (slot_id non-null, gérées par `PendingInvitations`
 * dans app/(club)/(tabs)/match.tsx) ne doivent jamais apparaître ici — les
 * deux types partagent la même requête source mais jamais le même affichage.
 * Source de vérité persistante des invitations club, indépendante du Match
 * Day. Même gabarit visuel que `ApplicationsPanel` (Card/CardHeader/
 * CardTitle/Badge), aucune nouvelle primitive UI.
 */
export function ClubInvitationsPanel({ clubId }: { clubId: string }) {
  const { data: allInvitations, isLoading, isError, error, refetch } = useClubInvitations(clubId);
  const invitations = useMemo(() => allInvitations?.filter((inv) => inv.slot_id === null), [allInvitations]);

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Send size={18} color="#f4f5f7" />}>Invitations envoyées</CardTitle>
        <Text className="text-sm text-fg-muted">{invitations?.length ?? 0}</Text>
      </CardHeader>

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : isError ? (
        <ErrorState
          message={__DEV__ && error instanceof Error ? error.message : "Impossible de charger les invitations."}
          onRetry={refetch}
        />
      ) : !invitations || invitations.length === 0 ? (
        <Text className="text-sm text-fg-muted">Tu n&apos;as envoyé aucune invitation.</Text>
      ) : (
        <View className="gap-2">
          {invitations.map((inv) => (
            <View key={inv.id} className="flex-row items-center justify-between gap-2 rounded-xl border border-border bg-bg-elevated p-3">
              <View className="shrink flex-1">
                <Text numberOfLines={1} className="font-bold text-fg">
                  {inv.user?.username ?? "Joueur"}
                </Text>
                <Text className="mt-0.5 text-xs text-fg-muted">Invitation au club · {timeAgo(inv.created_at)}</Text>
              </View>
              <Badge tone={STATUS_TONES[inv.status]}>{STATUS_LABELS[inv.status]}</Badge>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

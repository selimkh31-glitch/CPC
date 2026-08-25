import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { UserPlus } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { PlayerCard } from "@/components/player/PlayerCard";
import { buildPlayerCardData, PLAYER_CARD_COPY } from "@/lib/playerCard";
import { useClubInvitations, useInvitePlayerToClub } from "@/lib/hooks/useInvitations";
import { useInvitableClubPlayers } from "@/lib/hooks/usePlayerSearch";
import { toast } from "@/lib/toast";
import type { ClubMemberRow, InvitationStatus } from "@/lib/types";

/**
 * Effectif -> inviter un joueur NON membre à rejoindre le club (invitation
 * CLUB générale, `slot_id: null` — distincte de l'invitation MATCH/slot
 * gérée par app/(club)/(tabs)/match.tsx + app/player-search.tsx, jamais
 * touchées ici).
 *
 * L'état de chaque bouton est déterminé AVANT le tap, à partir de
 * `useClubInvitations` (même queryKey que "Invitations envoyées",
 * ClubInvitationsPanel.tsx — déjà chargée pour Recrutement, aucune requête
 * supplémentaire) : jamais de fetch au clic. `clubStatusByUserId` ne retient
 * que les invitations CLUB (`slot_id === null`) — la requête trie déjà
 * `created_at desc`, donc la première occurrence par joueur est la plus
 * récente (couvre le cas re-invité après DECLINED/CANCELLED).
 *
 * `localStatus` — pont optimiste LOCAL, posé de façon synchrone dans `act()`,
 * pour deux cas où la donnée serveur normalement consultée (invitations CLUB)
 * ne peut structurellement pas représenter l'état réel :
 * - juste après un envoi réussi (`setQueryData` dans `useInvitePlayerToClub`
 *   met déjà à jour le cache partagé, mais un fetch de `useClubInvitations`
 *   déjà en vol au même instant peut l'écraser avec des données antérieures) ;
 * - 409 "Ce joueur est déjà membre du club." (audit "cache club.members
 *   obsolète côté manager") — un joueur peut être devenu membre via une
 *   invitation MATCH (slot_id non-null, `invite-to-slot`) acceptée sur SON
 *   appareil : son statut n'apparaîtra JAMAIS dans `clubStatusByUserId`
 *   (filtré `slot_id === null`, volontairement — ce n'est pas une invitation
 *   CLUB), donc uniquement `localStatus` peut refléter "Membre" ici, en
 *   attendant que le refetch au focus de l'onglet Effectif
 *   (app/(club)/(tabs)/effectif.tsx) corrige durablement `club.members` (et
 *   donc `memberIds`/l'exclusion de la recherche pour les prochains tours).
 *
 * Priorité systématique à `clubStatusByUserId` (donnée serveur) dès qu'elle
 * connaît ce joueur — `localStatus` n'est qu'un pont temporaire, jamais un
 * blocage permanent sur une valeur périmée.
 */
export function InviteToClubPanel({ clubId, members }: { clubId: string; members: ClubMemberRow[] }) {
  const [query, setQuery] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Map<string, InvitationStatus>>(new Map());
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const { data: candidates, isLoading, isError, error, refetch } = useInvitableClubPlayers(query, memberIds);
  const { data: invitations } = useClubInvitations(clubId);
  const invite = useInvitePlayerToClub();

  const clubStatusByUserId = useMemo(() => {
    const map = new Map<string, InvitationStatus>();
    for (const inv of invitations ?? []) {
      if (inv.slot_id !== null) continue;
      if (!map.has(inv.user_id)) map.set(inv.user_id, inv.status);
    }
    return map;
  }, [invitations]);

  const markLocalStatus = (userId: string, status: InvitationStatus) =>
    setLocalStatus((prev) => {
      const next = new Map(prev);
      next.set(userId, status);
      return next;
    });

  const act = (userId: string) => {
    setPendingUserId(userId);
    invite.mutate(
      { clubId, userId },
      {
        onSuccess: () => {
          markLocalStatus(userId, "PENDING");
          toast.success("C'est envoyé.");
        },
        onError: (err: any) => {
          const message = typeof err?.message === "string" ? err.message : "Erreur";
          if (message.includes("déjà une invitation en attente")) {
            // 409 doublon — le serveur confirme un PENDING déjà existant :
            // même résultat visuel qu'un succès, jamais une erreur générique.
            markLocalStatus(userId, "PENDING");
          } else if (message.includes("déjà membre du club")) {
            // 409 déjà membre — cache club.members périmé côté manager (voir
            // docstring). Reflète "Membre" immédiatement, aucune erreur
            // affichée, plus aucune invitation possible depuis ce bouton.
            markLocalStatus(userId, "ACCEPTED");
          } else {
            toast.error(message);
          }
        },
        onSettled: () => setPendingUserId(null),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<UserPlus size={18} color="#f4f5f7" />}>Inviter au club</CardTitle>
      </CardHeader>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher un joueur par pseudo..."
        autoCapitalize="none"
        autoCorrect={false}
      />
      {query.trim().length < 2 ? (
        <Text className="mt-3 text-sm text-fg-muted">Tape au moins 2 caractères pour chercher un joueur.</Text>
      ) : isLoading ? (
        <View className="mt-3">
          <Skeleton className="h-14" />
        </View>
      ) : isError ? (
        <View className="mt-3">
          <ErrorState
            message={__DEV__ && error instanceof Error ? error.message : "Impossible de charger les joueurs."}
            onRetry={refetch}
          />
        </View>
      ) : !candidates || candidates.length === 0 ? (
        <Text className="mt-3 text-sm text-fg-muted">Aucun joueur trouvé.</Text>
      ) : (
        <View className="mt-3 gap-2">
          {candidates.map((player) => {
            const status = clubStatusByUserId.get(player.id) ?? localStatus.get(player.id);
            const isPending = status === "PENDING";
            const isAccepted = status === "ACCEPTED";
            const inviting = invite.isPending && pendingUserId === player.id;

            return (
              <PlayerCard
                key={player.id}
                data={buildPlayerCardData(player)}
                variant="mini"
                rightSlot={
                  isAccepted ? (
                    <Badge tone="accent">Membre</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant={isPending ? "secondary" : "primary"}
                      disabled={isPending}
                      loading={inviting}
                      onPress={() => act(player.id)}
                    >
                      {isPending ? "Invité" : status === "DECLINED" || status === "CANCELLED" ? "Inviter à nouveau" : PLAYER_CARD_COPY.invite}
                    </Button>
                  )
                }
              />
            );
          })}
        </View>
      )}
    </Card>
  );
}

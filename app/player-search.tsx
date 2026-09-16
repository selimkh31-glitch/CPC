import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { AppShell } from "@/components/nav/AppShell";
import { PlayerResultCard } from "@/components/club/PlayerResultCard";
import { useClub } from "@/lib/hooks/useClubs";
import { usePlayerSearch } from "@/lib/hooks/usePlayerSearch";
import { useInvitePlayer } from "@/lib/hooks/useInvitations";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { toast } from "@/lib/toast";

/** Club -> joueur (phase 4) : recherche de joueurs compatibles pour un slot précis. */
export default function PlayerSearchScreen() {
  const { clubId, slotId, position } = useLocalSearchParams<{ clubId: string; slotId: string; position: string }>();
  const router = useRouter();
  const { data: club } = useClub(clubId ?? null);
  const positionCode = (position ?? null) as PositionCode | null;
  const excludeUserIds = (club?.members ?? []).map((m) => m.user_id);
  const { data: players, isLoading, isError, refetch } = usePlayerSearch(positionCode, excludeUserIds);
  const invite = useInvitePlayer();

  const positionLabel = positionCode ? (POSITION_LABELS[positionCode] ?? positionCode) : "";

  return (
    <AppShell contentContainerStyle={{ gap: 12 }}>
      <View>
        <Text className="font-display text-title text-fg">Rechercher un joueur</Text>
        <Text className="font-sans text-bodySmall text-fg-muted">Pour le poste {positionLabel}</Text>
      </View>

      {isLoading ? (
        <>
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </>
      ) : isError ? (
        <ErrorState message="Impossible de charger les joueurs." onRetry={refetch} />
      ) : !players || players.length === 0 ? (
        <EmptyState title="Aucun joueur compatible trouvé pour l'instant." />
      ) : (
        players.map((player) => (
          <PlayerResultCard
            key={player.id}
            player={player}
            slotPosition={positionCode!}
            inviting={invite.isPending}
            onInvite={() =>
              invite.mutate(
                { clubId: clubId!, slotId: slotId!, userId: player.id },
                {
                  onSuccess: () => {
                    toast.success("Invitation envoyée !");
                    router.back();
                  },
                  onError: (err: any) => toast.error(err.message ?? "Erreur"),
                }
              )
            }
          />
        ))
      )}
    </AppShell>
  );
}

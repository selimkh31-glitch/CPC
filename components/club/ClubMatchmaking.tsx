import { ScrollView, Text, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { ClubMatchCard } from "@/components/club/ClubMatchCard";
import { useClubSearch } from "@/lib/hooks/useClubSearch";
import { useAuth } from "@/lib/providers/AuthProvider";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";

/**
 * Joueur -> club (phase 4 ; extrait en composant partagé à l'Étape 5) : clubs
 * dont un slot vide correspond au poste du joueur connecté. Réutilisé par la
 * route `/find-club` (inchangée) ET par l'onglet Club (contexte "sans club",
 * promu comme vue principale) — même logique, même moteur (useClubSearch,
 * déterministe, aucune IA), pas de duplication.
 */
export function ClubMatchmaking() {
  const { profile } = useAuth();
  const mainPosition = (profile?.main_position ?? null) as PositionCode | null;
  const secondaryPositions = (profile?.secondary_positions ?? []) as PositionCode[];
  const { data: matches, isLoading, isError, refetch } = useClubSearch(mainPosition, secondaryPositions);

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}>
      <View>
        <Text className="font-display text-2xl text-fg">Trouver un club</Text>
        {mainPosition && (
          <Text className="text-sm text-fg-muted">Postes recherchés pour {POSITION_LABELS[mainPosition]}</Text>
        )}
      </View>

      {isLoading ? (
        <>
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </>
      ) : isError ? (
        <ErrorState message="Impossible de charger les clubs." onRetry={refetch} />
      ) : !matches || matches.length === 0 ? (
        <EmptyState title="Aucun club ne recherche ton poste pour l'instant." />
      ) : (
        matches.map((match) => <ClubMatchCard key={match.club.id} match={match} />)
      )}
    </ScrollView>
  );
}

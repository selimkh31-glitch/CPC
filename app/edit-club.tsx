import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { EditClubForm } from "@/components/club/EditClubForm";
import { canEditClubIdentity } from "@/lib/clubIdentity";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useAuth } from "@/lib/providers/AuthProvider";

/**
 * Édition de l'identité du club géré (EA SPORTS FC 27 Pro Clubs) — champs
 * déjà posés à la création, UPDATE RLS `clubs_update_owner` (OWNER seulement).
 */
export default function EditClubScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: club, isLoading, isError, refetch } = useManagedClub();

  if (!userId) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title="Session requise pour modifier l'identité du club." />
      </ScrollView>
    );
  }

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64" />
      </ScrollView>
    );
  }

  if (isError) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <ErrorState message="Impossible de charger ce club." onRetry={refetch} />
      </ScrollView>
    );
  }

  if (!club) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <EmptyState
          title="Aucun club géré"
          subtitle="L'identité d'un club EA SPORTS FC 27 Pro Clubs se modifie depuis l'onglet Club."
        />
      </ScrollView>
    );
  }

  if (!canEditClubIdentity(club.owner_id, userId)) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <EmptyState
          title="Réservé à l'owner"
          subtitle="Seul l'owner peut modifier l'identité du club (RLS clubs_update_owner). Un manager gère le LIVE, pas ces champs."
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <Text className="mb-1 font-display text-2xl text-fg">Modifier l&apos;identité du club</Text>
      <Text className="mb-4 text-sm text-fg-muted">
        EA SPORTS FC 27 Pro Clubs — les changements se reflètent sur l&apos;onglet Club.
      </Text>
      <View className="w-full">
        <EditClubForm club={club} onDone={() => router.back()} />
      </View>
    </ScrollView>
  );
}

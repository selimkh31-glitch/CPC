import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Slot } from "expo-router";
import { Shield } from "lucide-react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/Screen";
import { MyClubsList } from "@/components/club/MyClubsList";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAppMode } from "@/lib/providers/AppModeProvider";

/**
 * Racine Mode Manager. Monté uniquement quand `mode === "CLUB"`.
 * Sans club géré : les tabs (LIVE / Recrutement / Club) gardent l'empty
 * state existant — pas de rebond forcé vers Joueur, pas de wizard club.
 */
export default function ClubModeLayout() {
  const { session } = useAuth();
  const { data: memberships, isLoading, isError } = useMyMemberships(session?.user.id ?? null);
  const { selectedManagedClubId, setSelectedManagedClubId } = useAppMode();

  const managedClubs = memberships?.filter((m) => (m.role === "OWNER" || m.role === "MANAGER") && m.club?.id) ?? [];
  const validSelection = Boolean(selectedManagedClubId) && managedClubs.some((m) => m.club.id === selectedManagedClubId);

  useEffect(() => {
    if (isLoading) return;
    if (managedClubs.length === 0) {
      if (selectedManagedClubId) setSelectedManagedClubId(null);
      return;
    }
    if (!validSelection && managedClubs.length === 1) {
      setSelectedManagedClubId(managedClubs[0].club.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, managedClubs.length, validSelection, selectedManagedClubId]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={[]}>
        <View style={{ padding: 16 }}>
          <Skeleton className="h-40" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={[]}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <EmptyState title="Impossible de charger tes clubs gérés." subtitle="Vérifie ta connexion." />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (managedClubs.length === 0) {
    return <Slot />;
  }

  if (!validSelection && managedClubs.length > 1) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={[]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}>
          <View className="mb-2 flex-row items-center gap-2">
            <Shield size={22} color="#39ff8a" />
            <Text className="font-display text-3xl text-fg">Quel club gérer ?</Text>
          </View>
          <MyClubsList memberships={managedClubs} isLoading={false} onManagedSelect={setSelectedManagedClubId} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!validSelection) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={[]}>
        <View style={{ padding: 16 }}>
          <Skeleton className="h-40" />
        </View>
      </SafeAreaView>
    );
  }

  return <Slot />;
}

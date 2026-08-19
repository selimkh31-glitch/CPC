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
 * Racine de l'arbre Mode Club (Foundation #1). Monté uniquement quand
 * `mode === "CLUB"` (garde posée dans app/_layout.tsx — jamais ici, ce
 * composant suppose déjà session+profile+mode valides).
 *
 * Rôle unique : garantir qu'un `selectedManagedClubId` valide existe avant de
 * rendre les tabs Mode Club (app/(club)/(tabs)/...). `selectedManagedClubId`
 * n'est JAMAIS pris pour une vérité persistante (le ModeSwitch ne le pose
 * lui-même que dans le cas non ambigu à 1 seul club géré) — revalidé ici
 * contre `useMyMemberships`, la même source de vérité que partout ailleurs.
 * Jamais de `managedClubs[0]` implicite : 1 club -> sélection directe (non
 * ambigu) ; plusieurs -> sélecteur explicite (réutilise MyClubsList en mode
 * sélection, sans navigation).
 */
export default function ClubModeLayout() {
  const { session } = useAuth();
  const { data: memberships, isLoading, isError, refetch } = useMyMemberships(session?.user.id ?? null);
  const { setMode, selectedManagedClubId, setSelectedManagedClubId } = useAppMode();

  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
  const validSelection = Boolean(selectedManagedClubId) && managedClubs.some((m) => m.club.id === selectedManagedClubId);

  useEffect(() => {
    if (isLoading) return;
    // Défensif — ne devrait pas arriver si le ModeSwitch est correctement
    // conditionné (masqué dès managedClubs.length === 0), mais un compte peut
    // en théorie perdre son dernier club géré (libéré, transféré) pendant
    // qu'il est déjà en Mode Club : jamais d'écran vide, retour Mode Joueur.
    if (managedClubs.length === 0) {
      setMode("PLAYER");
      return;
    }
    // 1 seul club géré, non ambigu : sélection directe sans sélecteur.
    if (!validSelection && managedClubs.length === 1) {
      setSelectedManagedClubId(managedClubs[0].club.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, managedClubs.length, validSelection]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <View style={{ padding: 16 }}>
          <Skeleton className="h-40" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <EmptyState title="Impossible de charger tes clubs gérés." subtitle="Vérifie ta connexion." />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Plusieurs clubs gérés, aucune sélection valide : sélecteur explicite,
  // jamais un `[0]` implicite. `onManagedSelect` -> callback pur (pose
  // seulement selectedManagedClubId), aucune navigation.
  if (!validSelection && managedClubs.length > 1) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
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
    // managedClubs.length === 0 (retour Mode Joueur en cours) ou
    // auto-sélection à 1 club pas encore appliquée (un seul re-render).
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <View style={{ padding: 16 }}>
          <Skeleton className="h-40" />
        </View>
      </SafeAreaView>
    );
  }

  return <Slot />;
}

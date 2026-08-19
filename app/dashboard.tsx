import { useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppMode } from "@/lib/providers/AppModeProvider";

/**
 * Foundation #1 — `/dashboard` n'est plus un écran de gestion (l'ancien
 * "pseudo Mode Club" à un seul écran, retiré). C'est désormais UNIQUEMENT un
 * shim de compatibilité pour les deep links historiques
 * (`/dashboard?clubId=X`, `/dashboard?create=1`) — notifications push
 * existantes, liens externes, ou tout appelant pas encore migré (voir
 * MyClubsList, fallback conservé volontairement).
 *
 * `clubId` fourni -> bascule en Mode Club avec ce club présélectionné (revalidé
 * ensuite contre les memberships réels par app/(club)/_layout.tsx — jamais
 * pris pour argent comptant ici). `create=1` -> redirigé vers /create-club,
 * qui n'a pas sa place dans le nouvel arbre (club), un club géré doit déjà
 * exister pour qu'il y ait quelque chose à afficher dans ses tabs.
 *
 * Aucune navigation impérative vers un écran de mode : on change seulement
 * `mode`/`selectedManagedClubId`, puis on se retire. `router.replace("/")`
 * plutôt que `router.back()` : cet écran peut être le tout premier ouvert
 * (deep link/notification push à froid, sans historique à dépiler) — le
 * Stack.Protected racine (app/_layout.tsx) résout `/` vers l'arbre approprié
 * (player)/(club) selon `mode`, exactement le même principe que le switch
 * explicite.
 */
export default function DashboardRedirectScreen() {
  const { clubId, create } = useLocalSearchParams<{ clubId?: string; create?: string }>();
  const { setMode, setSelectedManagedClubId } = useAppMode();

  useEffect(() => {
    if (create === "1") {
      router.replace("/create-club");
      return;
    }
    if (clubId) setSelectedManagedClubId(clubId);
    setMode("CLUB");
    router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 bg-bg" style={{ padding: 16 }}>
      <Skeleton className="h-40" />
    </View>
  );
}

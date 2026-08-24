import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react-native";
import { CreateClubForm } from "@/components/club/CreateClubForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useAuth } from "@/lib/providers/AuthProvider";

/**
 * Foundation #1 — remplace l'ancien `dashboard.tsx?create=1`. Écran stack
 * partagé (hors des deux arbres de mode, comme find-club/player-search), issu
 * de app/(player)/(tabs)/clubs.tsx et app/(player)/(tabs)/profile.tsx.
 * Après création, bascule directement en Mode Club sur le club créé — jamais
 * un `router.push("/dashboard")` : c'est un changement d'état (AppModeProvider),
 * le Stack.Protected racine se charge de monter l'arbre (club) tout seul.
 *
 * Architecture B (audit) — écran root partagé conservé (guard `session &&
 * profile` uniquement, indépendant de `mode` : deep link `/create-club`
 * toujours joignable, y compris à chaud en Mode Club). `onCreated` ne fait
 * QUE de l'état, aucune navigation : refetch réel de ["my-memberships",
 * userId] (garantit que app/(club)/_layout.tsx trouvera le nouveau club géré
 * dès son premier rendu), puis `setSelectedManagedClubId` + `setMode("CLUB")`
 * + un flag local `createdClubId`.
 *
 * La navigation elle-même est déclenchée par le `useEffect` ci-dessous,
 * jamais dans `onCreated` : un effet ne s'exécute qu'APRÈS le commit React
 * qui reflète le nouvel état (garantie native de React, pas un délai
 * arbitraire) — donc au moment où `router.replace("/")` s'exécute,
 * app/_layout.tsx a déjà recalculé son Stack.Protected avec `mode === "CLUB"`
 * et `(club)` est déjà une route valide. Élimine la course React identifiée
 * par l'audit (router.replace appelé synchronement juste après setMode,
 * avant que le guard n'ait eu le temps de se propager).
 *
 * Fallback UX : `router.replace("/")` sur la racine ambiguë s'est révélé
 * pas toujours fiable en pratique (l'écran reste affiché malgré `mode ===
 * "CLUB"` déjà commité). Tant que ce point n'est pas ré-investigué, on
 * n'y touche pas (comportement automatique conservé tel quel) mais on
 * affiche, dès que `createdClubId` est posé, un CTA explicite indépendant
 * qui cible `/(club)/(tabs)` (accueil LIVE du Mode Club) plutôt que de
 * dépendre de la résolution de "/".
 */
export default function CreateClubScreen() {
  const { session } = useAuth();
  const { mode, setMode, setSelectedManagedClubId } = useAppMode();
  const queryClient = useQueryClient();
  const [createdClubId, setCreatedClubId] = useState<string | null>(null);

  useEffect(() => {
    if (createdClubId && mode === "CLUB") {
      router.replace("/");
    }
  }, [createdClubId, mode]);

  if (createdClubId) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <Card>
          <View className="mb-2 flex-row items-center gap-2">
            <CheckCircle2 size={22} color="#39ff8a" />
            <Text className="font-display text-lg uppercase tracking-wide text-fg">Club créé avec succès</Text>
          </View>
          <Text className="mb-4 text-fg-muted">Ton club est prêt.</Text>
          <Button
            onPress={() => {
              // Idempotent — déjà posés dans `onCreated` ci-dessous, mais le
              // CTA doit fonctionner seul, sans dépendre de cet état antérieur.
              setSelectedManagedClubId(createdClubId);
              setMode("CLUB");
              router.replace("/(club)/(tabs)");
            }}
          >
            Accéder à la gestion du club →
          </Button>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
      <CreateClubForm
        onCreated={async (club) => {
          // Même queryKey exacte que useMyMemberships (lib/hooks/useClubs.ts) —
          // garantit que app/(club)/_layout.tsx trouvera le nouveau club géré
          // dès son premier rendu.
          await queryClient.refetchQueries({ queryKey: ["my-memberships", session?.user.id ?? null] });
          setSelectedManagedClubId(club.id);
          setMode("CLUB");
          setCreatedClubId(club.id);
        }}
      />
    </ScrollView>
  );
}

import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react-native";
import { CreateClubForm } from "@/components/club/CreateClubForm";
import { LinkEaClubForm } from "@/components/profile/LinkEaClubForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useClub } from "@/lib/hooks/useClubs";

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
 * Après création : offre « Lier le club EA » (même confirm / clubId).
 * Pas d'auto-redirect — le LIVE marche sans lien EA. CTA explicite vers
 * `/(club)/(tabs)` (accueil LIVE du Mode Club).
 */
export default function CreateClubScreen() {
  const { session } = useAuth();
  const { setMode, setSelectedManagedClubId } = useAppMode();
  const queryClient = useQueryClient();
  const [createdClubId, setCreatedClubId] = useState<string | null>(null);
  const { data: createdClub } = useClub(createdClubId);

  if (createdClubId) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card>
          <View className="mb-2 flex-row items-center gap-2">
            <CheckCircle2 size={22} color="#39ff8a" />
            <Text className="font-display text-lg uppercase tracking-wide text-fg">Club créé avec succès</Text>
          </View>
          <Text className="mb-4 text-fg-muted">Ton club est prêt. Tu peux lier le vrai club EA — le LIVE marche déjà sans.</Text>
          <LinkEaClubForm
            embedded
            target="managed-club"
            cpcClubId={createdClubId}
            linkedClubId={createdClub?.ea_club_id ?? null}
          />
          <View className="mt-4">
            <Button
              onPress={() => {
                setSelectedManagedClubId(createdClubId);
                setMode("CLUB");
                router.replace("/(club)/(tabs)");
              }}
            >
              {createdClub?.ea_club_id ? "Accéder à la gestion du club →" : "Plus tard — accéder au club"}
            </Button>
          </View>
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

import { Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ClubCard } from "@/components/club/ClubCard";
import { buildClubCardData } from "@/lib/clubCard";
import type { ClubRole, ClubRow } from "@/lib/types";

/**
 * Liste "Mes clubs" (Phase 4.5, extraite en composant partagé à l'Étape 5 ;
 * étendue pour Foundation #1 Mode Joueur/Mode Club) — réutilisée par le
 * profil (raccourci secondaire), par le sélecteur de club géré en Mode Club
 * (app/(club)/_layout.tsx) et par l'ancien sélecteur "plusieurs clubs" côté
 * Mode Joueur (retiré de clubs.tsx ; bascule « Passer en manager » sur Profil).
 *
 * Deux comportements au tap d'une ligne OWNER/MANAGER, selon ce que
 * l'appelant fournit :
 *   - `onManagedSelect` fourni -> callback pur, AUCUNE navigation (mode
 *     sélection — c'est le AppModeProvider qui pilote l'affichage ensuite,
 *     jamais un router.push/replace ici).
 *   - `onManagedSelect` absent -> comportement historique inchangé
 *     (`navigationMode`, "push" par défaut) : conservé pour ne casser aucun
 *     appelant existant qui ne serait pas encore migré.
 * Une ligne MEMBER va TOUJOURS vers /match-sheet (feuille de match, Mode
 * Joueur) — jamais concernée par `onManagedSelect`.
 */
export function MyClubsList({
  memberships,
  isLoading,
  navigationMode = "push",
  onManagedSelect,
}: {
  memberships: { role: ClubRole; club: ClubRow }[] | undefined;
  isLoading: boolean;
  navigationMode?: "push" | "replace";
  /** Si fourni, une ligne OWNER/MANAGER appelle ce callback (clubId) au lieu
   *  de naviguer — utilisé pour la sélection du club géré en Mode Club. */
  onManagedSelect?: (clubId: string) => void;
}) {
  const goToClub = (clubId: string, role: ClubRole) => {
    Haptics.selectionAsync();
    if (role === "OWNER" || role === "MANAGER") {
      if (onManagedSelect) {
        onManagedSelect(clubId);
        return;
      }
      router[navigationMode](`/dashboard?clubId=${clubId}`);
      return;
    }
    router[navigationMode](`/match-sheet?clubId=${clubId}`);
  };

  if (isLoading) {
    return <Skeleton className="h-16" />;
  }

  if (!memberships || memberships.length === 0) {
    return (
      <Card>
        <Text className="text-sm text-fg-muted">
          Tu n&apos;es membre d&apos;aucun club pour l&apos;instant. Trouve un club ou crée le tien.
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-2">
      {memberships.map(({ club, role }) => (
        <ClubCard
          key={club.id}
          data={buildClubCardData(club)}
          variant="mini"
          onPress={() => goToClub(club.id, role)}
          rightSlot={
            <Badge tone={role === "OWNER" ? "pro" : role === "MANAGER" ? "accent" : "neutral"}>
              {role === "OWNER" ? "Owner" : role === "MANAGER" ? "Manager" : "Membre"}
            </Badge>
          }
        />
      ))}
    </View>
  );
}

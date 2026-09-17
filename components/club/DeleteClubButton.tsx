import { Alert } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { useDeleteClub } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";

/**
 * OWNER only — destruction définitive (RLS clubs_delete_owner).
 * Distinct de « Quitter le club » (membres).
 */
export function DeleteClubButton({ clubId, clubName }: { clubId: string; clubName?: string | null }) {
  const del = useDeleteClub(clubId);
  const label = clubName?.trim() ? clubName.trim() : "ce club";

  const confirm = () => {
    if (del.isPending) return;
    Alert.alert(
      "Supprimer le club ?",
      `${label} sera définitivement retiré : membres, feuille, sessions LIVE et candidatures. Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer le club",
          style: "destructive",
          onPress: () => {
            del.mutate(undefined, {
              onSuccess: () => {
                toast.success("Club supprimé.");
                router.replace("/(club)/(tabs)/home");
              },
              onError: (err: unknown) => {
                toast.error(err instanceof Error ? err.message : "Impossible de supprimer le club.");
              },
            });
          },
        },
      ]
    );
  };

  return (
    <Button variant="danger" loading={del.isPending} onPress={confirm} accessibilityLabel="Supprimer le club">
      Supprimer le club
    </Button>
  );
}

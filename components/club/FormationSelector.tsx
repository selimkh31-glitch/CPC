import { useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { ChevronDown, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { FORMATION_IDS, type FormationId } from "@/lib/formations";
import { useUpdateFormation } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";

/**
 * Sélecteur de formation (owner/manager uniquement) — liste exclusivement
 * FORMATION_IDS de lib/formations.ts, jamais recréée ici. Modal natif RN :
 * aucune librairie de bottom sheet dans le projet, pas de nouvelle dépendance.
 */
export function FormationSelector({
  clubId,
  currentFormation,
  hasAssignments,
}: {
  clubId: string;
  currentFormation: FormationId | null;
  hasAssignments: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useUpdateFormation(clubId);

  const applyFormation = (next: FormationId) => {
    setOpen(false);
    if (next === currentFormation) return;
    mutation.mutate(next, {
      onSuccess: () => toast.success(`Formation changée : ${next}.`),
      onError: (err: any) => toast.error(err.message ?? "Erreur"),
    });
  };

  const selectFormation = (next: FormationId) => {
    if (next === currentFormation) {
      setOpen(false);
      return;
    }
    if (!hasAssignments) {
      applyFormation(next);
      return;
    }
    Alert.alert(
      "Changer de formation ?",
      "Les membres resteront dans le club, mais les joueurs actuellement placés devront être réassignés.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Changer", style: "destructive", onPress: () => applyFormation(next) },
      ]
    );
  };

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen(true);
        }}
        className="flex-row items-center gap-1 self-start rounded-xl border border-border bg-bg-elevated px-3 py-2 active:opacity-80"
      >
        <Text className="font-display text-base text-fg">{currentFormation ?? "Choisir une formation"}</Text>
        <ChevronDown size={16} color="#9aa0a8" />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setOpen(false)}>
          <Pressable className="rounded-t-3xl border-t border-border bg-bg-card px-4 pb-8 pt-4" onPress={() => {}}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-display text-lg uppercase tracking-wide text-fg">Formation</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <X size={20} color="#9aa0a8" />
              </Pressable>
            </View>
            <View className="gap-1.5">
              {FORMATION_IDS.map((id) => (
                <Pressable
                  key={id}
                  onPress={() => selectFormation(id)}
                  className={`rounded-xl px-4 py-3 active:opacity-80 ${
                    id === currentFormation ? "bg-accent/15" : "bg-bg-elevated"
                  }`}
                >
                  <Text className={`font-semibold ${id === currentFormation ? "text-accent" : "text-fg"}`}>{id}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

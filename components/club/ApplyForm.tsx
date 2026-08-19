import { useState } from "react";
import { Text, View } from "react-native";
import { Send } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { useApply } from "@/lib/hooks/useApply";
import { toast } from "@/lib/toast";

/** Bouton "Postuler" en 1 clic + message optionnel (section 3.D). */
export function ApplyForm({ sessionId, neededPositions }: { sessionId: string; neededPositions: string[] }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState(neededPositions[0] ?? "");
  const mutation = useApply();

  const apply = () => {
    if (!position) {
      toast.error("Sélectionne un poste.");
      return;
    }
    mutation.mutate(
      { sessionId, position, message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Candidature envoyée !");
          setOpen(false);
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  if (!open) {
    return (
      <Button icon={<Send size={16} color="#08090b" />} onPress={() => setOpen(true)}>
        Postuler
      </Button>
    );
  }

  return (
    <View className="gap-3 rounded-xl border border-border bg-bg-elevated p-3">
      <Text className="text-xs font-bold uppercase tracking-wide text-fg-muted">Poste visé</Text>
      <ChipSelect
        single
        value={[position]}
        onChange={(v) => setPosition(v[0] ?? position)}
        options={neededPositions.map((p) => ({ value: p, label: POSITION_LABELS[p as PositionCode] ?? p }))}
      />
      <Textarea placeholder="Message (optionnel)" value={message} onChangeText={setMessage} maxLength={280} />
      <View className="flex-row gap-2">
        <Button variant="secondary" className="flex-1" onPress={() => setOpen(false)}>
          Annuler
        </Button>
        <Button className="flex-1" loading={mutation.isPending} onPress={apply}>
          Envoyer
        </Button>
      </View>
    </View>
  );
}

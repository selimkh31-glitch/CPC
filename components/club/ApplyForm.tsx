import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Send } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { useApply } from "@/lib/hooks/useApply";
import { useAuth } from "@/lib/providers/AuthProvider";
import { playerPlaysPosition } from "@/lib/liveMatch";
import { toast } from "@/lib/toast";

/** Bouton "Postuler" en 1 clic + message optionnel. Poste ∈ besoin ∩ profil. */
export function ApplyForm({ sessionId, neededPositions }: { sessionId: string; neededPositions: string[] }) {
  const { profile } = useAuth();
  const playable = useMemo(() => {
    if (!profile) return [];
    const player = {
      mainPosition: profile.main_position,
      secondaryPositions: profile.secondary_positions ?? [],
      platform: profile.platform,
    };
    return neededPositions.filter((p) => playerPlaysPosition(player, p));
  }, [profile, neededPositions]);

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState(playable[0] ?? "");
  const mutation = useApply();

  const apply = () => {
    if (mutation.isPending) return;
    const selected = position || playable[0] || "";
    if (!selected) {
      toast.error("Sélectionne un poste.");
      return;
    }
    mutation.mutate(
      { sessionId, position: selected, message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Candidature envoyée !");
          setOpen(false);
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  if (!profile) {
    return <Text className="text-sm text-fg-muted">Termine l&apos;onboarding pour postuler.</Text>;
  }

  if (playable.length === 0) {
    return (
      <Text className="text-sm text-fg-muted">
        Aucun de tes postes (principal / secondaire) n&apos;est recherché sur ce LIVE.
      </Text>
    );
  }

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
        value={[position || playable[0]]}
        onChange={(v) => setPosition(v[0] ?? position)}
        options={playable.map((p) => ({ value: p, label: POSITION_LABELS[p as PositionCode] ?? p }))}
      />
      <Textarea placeholder="Message (optionnel)" value={message} onChangeText={setMessage} maxLength={280} />
      <View className="flex-row gap-2">
        <Button variant="secondary" className="flex-1" disabled={mutation.isPending} onPress={() => setOpen(false)}>
          Annuler
        </Button>
        <Button className="flex-1" loading={mutation.isPending} onPress={apply}>
          Envoyer
        </Button>
      </View>
    </View>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { Send } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { useApply } from "@/lib/hooks/useApply";
import { useAuth } from "@/lib/providers/AuthProvider";
import { usePlayerJoinCta } from "@/lib/hooks/usePlayerJoinCta";
import { playableNeededPositions, PLAYER_JOIN_COPY } from "@/lib/playerJoinCta";
import { toast } from "@/lib/toast";
import { cpcHex } from "@/lib/design/cpc-native";
import type { LiveSessionLike } from "@/lib/live";

/** Bouton Rejoindre + message optionnel. Poste ∈ besoin ∩ profil. Candidature PENDING. */
export function ApplyForm({
  sessionId,
  clubId,
  neededPositions,
  session,
  blocked = false,
  autoOpen = false,
}: {
  sessionId: string;
  clubId: string;
  neededPositions: string[];
  session: LiveSessionLike & { id?: string };
  blocked?: boolean;
  autoOpen?: boolean;
}) {
  const { profile } = useAuth();
  const join = usePlayerJoinCta({
    clubId,
    session,
    neededPositions,
    blocked,
  });
  const playable = useMemo(
    () => playableNeededPositions(profile ? { mainPosition: profile.main_position, secondaryPositions: profile.secondary_positions } : null, neededPositions),
    [profile, neededPositions]
  );

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState(playable[0] ?? "");
  const mutation = useApply();

  useEffect(() => {
    if (autoOpen && join.showJoin) setOpen(true);
  }, [autoOpen, join.showJoin]);

  useEffect(() => {
    if (!position && playable[0]) setPosition(playable[0]);
  }, [playable, position]);

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
        onSuccess: (data) => {
          toast.success(data?.alreadyPending ? "Candidature déjà envoyée." : "Candidature envoyée !");
          setOpen(false);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Erreur";
          toast.error(msg);
        },
      }
    );
  };

  if (!join.showJoin) {
    if (join.kind === "need_auth") {
      return (
        <Link href="/(auth)/login" className="min-h-[44px] justify-center font-sans-semibold text-body text-accent">
          {PLAYER_JOIN_COPY.needAuth}
        </Link>
      );
    }
    return <Text className="font-sans text-body text-fg-muted">{join.message ?? PLAYER_JOIN_COPY.closed}</Text>;
  }

  if (!open) {
    return (
      <Button icon={<Send size={16} color={cpcHex.background} />} onPress={() => setOpen(true)}>
        {PLAYER_JOIN_COPY.rejoindre}
      </Button>
    );
  }

  return (
    <View className="gap-3 border border-border bg-bg-elevated p-3">
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

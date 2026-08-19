import { useState } from "react";
import { View } from "react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { CLUB_LEVELS, CLUB_LEVEL_LABELS, LANGUAGES, LANGUAGE_LABELS } from "@/lib/constants";
import { useCreateClub } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";
import type { ClubRow } from "@/lib/types";

/**
 * Créer un club (section 3.B). `onCreated` optionnel (Foundation #1) — permet
 * à l'écran appelant (app/create-club.tsx) de basculer en Mode Club sur le
 * club fraîchement créé sans que ce composant connaisse AppModeProvider :
 * comportement historique (juste un toast) inchangé si non fourni.
 */
export function CreateClubForm({ onCreated }: { onCreated?: (club: ClubRow) => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("CASUAL");
  const [languages, setLanguages] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const mutation = useCreateClub();

  const submit = () => {
    if (!session || !name.trim() || languages.length === 0) {
      toast.error("Nom et au moins une langue sont requis.");
      return;
    }
    mutation.mutate(
      { name: name.trim(), level, languages, description: description.trim() || undefined, ownerId: session.user.id },
      {
        onSuccess: (club) => {
          toast.success("Club créé !");
          onCreated?.(club);
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer ton club</CardTitle>
      </CardHeader>
      <View className="gap-3">
        <View>
          <Label>Nom du club</Label>
          <Input value={name} onChangeText={setName} placeholder="Les Invincibles" />
        </View>
        <View>
          <Label>Niveau</Label>
          <ChipSelect single value={[level]} onChange={(v) => setLevel(v[0] ?? "CASUAL")} options={CLUB_LEVELS.map((l) => ({ value: l, label: CLUB_LEVEL_LABELS[l] }))} />
        </View>
        <View>
          <Label>Langues du club</Label>
          <ChipSelect value={languages} onChange={setLanguages} options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))} />
        </View>
        <View>
          <Label>Description (optionnel)</Label>
          <Textarea value={description} onChangeText={setDescription} placeholder="Ambiance, objectifs, exigences..." />
        </View>
        <Button loading={mutation.isPending} onPress={submit}>
          Créer le club
        </Button>
      </View>
    </Card>
  );
}

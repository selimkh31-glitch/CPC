import { useState } from "react";
import { Text, View } from "react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { CLUB_LEVELS, CLUB_LEVEL_LABELS, LANGUAGES, LANGUAGE_LABELS } from "@/lib/constants";
import { useUpdateClub } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";
import type { ClubRow } from "@/lib/types";

/** Édition d'un club existant — mêmes champs que CreateClubForm (section 4 du workflow LIVE). */
export function EditClubForm({ club, onDone }: { club: ClubRow; onDone: () => void }) {
  const [name, setName] = useState(club.name);
  const [level, setLevel] = useState<string>(club.level);
  const [languages, setLanguages] = useState<string[]>(club.languages);
  const [description, setDescription] = useState(club.description ?? "");
  const [voiceLink, setVoiceLink] = useState(club.voice_link ?? "");
  const mutation = useUpdateClub(club.id);

  const submit = () => {
    if (!name.trim() || languages.length === 0) {
      toast.error("Nom et au moins une langue sont requis.");
      return;
    }
    mutation.mutate(
      { name: name.trim(), level, languages, description: description.trim() || undefined, voiceLink: voiceLink.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Club mis à jour !");
          onDone();
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modifier le club</CardTitle>
      </CardHeader>
      <View className="gap-3">
        <View>
          <Label>Nom du club</Label>
          <Input value={name} onChangeText={setName} placeholder="Les Invincibles" />
        </View>
        <View>
          <Label>Niveau</Label>
          <ChipSelect single value={[level]} onChange={(v) => setLevel(v[0] ?? level)} options={CLUB_LEVELS.map((l) => ({ value: l, label: CLUB_LEVEL_LABELS[l] }))} />
        </View>
        <View>
          <Label>Langues du club</Label>
          <ChipSelect value={languages} onChange={setLanguages} options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))} />
        </View>
        <View>
          <Label>Description (optionnel)</Label>
          <Textarea value={description} onChangeText={setDescription} placeholder="Ambiance, objectifs, exigences..." />
        </View>
        <View>
          <Label>Lien vocal du club (optionnel)</Label>
          <Input
            value={voiceLink}
            onChangeText={setVoiceLink}
            placeholder="https://discord.gg/..."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text className="mt-1 text-xs text-fg-subtle">Discord, TeamSpeak, etc.</Text>
        </View>
        <View className="flex-row gap-2">
          <Button variant="secondary" className="flex-1" onPress={onDone}>
            Annuler
          </Button>
          <Button className="flex-1" loading={mutation.isPending} onPress={submit}>
            Enregistrer
          </Button>
        </View>
      </View>
    </Card>
  );
}

import { useState } from "react";
import { Text, View } from "react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { CLUB_LEVELS, CLUB_LEVEL_LABELS, LANGUAGES, LANGUAGE_LABELS } from "@/lib/constants";
import { validateClubIdentity } from "@/lib/clubIdentity";
import { useUpdateClub } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";
import type { ClubRow } from "@/lib/types";

function clubErrorMessage(err: { message?: string } | null): string {
  return err?.message ?? "Impossible d'enregistrer.";
}

/** Formulaire d'édition de l'identité club — mêmes champs que CreateClubForm + vocal déjà persisté. */
export function EditClubForm({ club, onDone }: { club: ClubRow; onDone: () => void }) {
  const [name, setName] = useState(club.name);
  const [level, setLevel] = useState<string>(club.level);
  const [languages, setLanguages] = useState<string[]>(club.languages ?? []);
  const [description, setDescription] = useState(club.description ?? "");
  const [voiceLink, setVoiceLink] = useState(club.voice_link ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useUpdateClub(club.id);

  const submit = () => {
    const payload = {
      name,
      level,
      languages,
      description,
      voice_link: voiceLink,
    };
    const validated = validateClubIdentity(payload);
    if (!validated.ok) {
      setFormError(validated.message);
      toast.error(validated.message);
      return;
    }
    setFormError(null);
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Identité du club mise à jour.");
        onDone();
      },
      onError: (err: unknown) => {
        const message = clubErrorMessage(err as { message?: string });
        setFormError(message);
        toast.error(message);
      },
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Identité EA SPORTS FC 27 Pro Clubs</CardTitle>
      </CardHeader>
      <Text className="mb-4 text-sm text-fg-muted">
        Nom, niveau, langues, description et vocal du club. Owner, formation et identifiant EA : non modifiables ici.
      </Text>
      <View className="gap-4">
        <View>
          <Label>Nom du club</Label>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Les Invincibles"
            accessibilityLabel="Nom du club Pro Clubs"
          />
        </View>
        <View>
          <Label>Niveau</Label>
          <ChipSelect
            single
            value={level ? [level] : []}
            onChange={(v) => setLevel(v[0] ?? level)}
            options={CLUB_LEVELS.map((l) => ({ value: l, label: CLUB_LEVEL_LABELS[l] }))}
          />
        </View>
        <View>
          <Label>Langues du club</Label>
          <ChipSelect
            value={languages}
            onChange={setLanguages}
            options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
          />
        </View>
        <View>
          <Label>Description (optionnel)</Label>
          <Textarea
            value={description}
            onChangeText={setDescription}
            placeholder="Ambiance, objectifs, exigences..."
            accessibilityLabel="Description du club"
          />
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
            accessibilityLabel="Lien vocal du club"
          />
          <Text className="mt-1 text-xs text-fg-subtle">Discord, Party, TeamSpeak — ouvert tel quel.</Text>
        </View>

        {formError ? <Text className="text-sm text-danger">{formError}</Text> : null}

        <View className="flex-row gap-2">
          <Button variant="secondary" className="min-h-[44px] flex-1" onPress={onDone}>
            Annuler
          </Button>
          <Button className="min-h-[44px] flex-1" loading={mutation.isPending} onPress={submit}>
            Enregistrer
          </Button>
        </View>
      </View>
    </Card>
  );
}

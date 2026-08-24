import { useState } from "react";
import { Text, View } from "react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChipSelect } from "@/components/ui/ChipSelect";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  PLATFORMS,
  PLATFORM_LABELS,
  PLAY_STYLES,
  PLAY_STYLE_LABELS,
  POSITIONS,
  POSITION_LABELS,
} from "@/lib/constants";
import {
  AVAILABILITY_SLOTS,
  availabilitySlotsFromUser,
  validateProfileIdentity,
} from "@/lib/profileIdentity";
import { useUpdateOwnProfile } from "@/lib/hooks/useProfile";
import { toast } from "@/lib/toast";
import type { UserRow } from "@/lib/types";

function profileErrorMessage(err: { message?: string } | null): string {
  const message = err?.message ?? "Impossible d'enregistrer.";
  if (message.toLowerCase().includes("duplicate")) return "Ce username est déjà pris.";
  return message;
}

/** Formulaire d'édition de l'identité Pro Clubs — mêmes champs que l'onboarding. */
export function EditProfileForm({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const [username, setUsername] = useState(user.username);
  const [platform, setPlatform] = useState<string>(user.platform);
  const [mainPosition, setMainPosition] = useState<string>(user.main_position);
  const [secondaryPositions, setSecondaryPositions] = useState<string[]>(
    (user.secondary_positions ?? []).filter((p) => p !== user.main_position)
  );
  const [playStyle, setPlayStyle] = useState<string>(user.play_style);
  const [languages, setLanguages] = useState<string[]>(user.languages ?? []);
  const [availability, setAvailability] = useState<string[]>(availabilitySlotsFromUser(user.availability));
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useUpdateOwnProfile();

  const submit = () => {
    const payload = {
      username,
      platform,
      main_position: mainPosition,
      secondary_positions: secondaryPositions,
      play_style: playStyle,
      languages,
      availability: { slots: availability },
    };
    const validated = validateProfileIdentity(payload);
    if (!validated.ok) {
      setFormError(validated.message);
      toast.error(validated.message);
      return;
    }
    setFormError(null);
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Identité Pro Clubs mise à jour.");
        onDone();
      },
      onError: (err: unknown) => {
        const message = profileErrorMessage(err as { message?: string });
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
        Username, plateforme, postes et style affichés sur ta ClubPro Card. Langues et dispos comme à l&apos;onboarding.
        Fiabilité CPC, stats EA, plan : non modifiables ici.
      </Text>
      <View className="gap-4">
        <View>
          <Label>Username</Label>
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            placeholder="ex: xX_Striker_Xx"
            accessibilityLabel="Username Pro Clubs"
          />
        </View>
        <View>
          <Label>Plateforme</Label>
          <ChipSelect
            single
            value={platform ? [platform] : []}
            onChange={(v) => setPlatform(v[0] ?? "")}
            options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] }))}
          />
        </View>
        <View>
          <Label>Poste principal</Label>
          <ChipSelect
            single
            value={mainPosition ? [mainPosition] : []}
            onChange={(v) => {
              const next = v[0] ?? "";
              setMainPosition(next);
              setSecondaryPositions((prev) => prev.filter((p) => p !== next));
            }}
            options={POSITIONS.map((p) => ({ value: p, label: POSITION_LABELS[p] }))}
          />
        </View>
        <View>
          <Label>Postes secondaires (optionnel, max 2)</Label>
          <ChipSelect
            max={2}
            value={secondaryPositions}
            onChange={setSecondaryPositions}
            options={POSITIONS.filter((p) => p !== mainPosition).map((p) => ({ value: p, label: POSITION_LABELS[p] }))}
          />
        </View>
        <View>
          <Label>Style de jeu</Label>
          <ChipSelect
            single
            value={playStyle ? [playStyle] : []}
            onChange={(v) => setPlayStyle(v[0] ?? "")}
            options={PLAY_STYLES.map((p) => ({ value: p, label: PLAY_STYLE_LABELS[p] }))}
          />
        </View>
        <View>
          <Label>Langues</Label>
          <ChipSelect
            value={languages}
            onChange={setLanguages}
            options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
          />
        </View>
        <View>
          <Label>Disponibilités (optionnel)</Label>
          <ChipSelect
            value={availability}
            onChange={setAvailability}
            options={AVAILABILITY_SLOTS.map((s) => ({ value: s.value, label: s.label }))}
          />
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

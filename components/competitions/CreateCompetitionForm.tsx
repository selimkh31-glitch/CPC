import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateCompetition } from "@/lib/hooks/useCompetitions";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";
import {
  COMPETITION_COPY,
  COMPETITION_STATUS_LABELS,
  type CompetitionCreateStatus,
} from "@/lib/competitions";
import type { CompetitionRow } from "@/lib/types";

const STATUS_OPTIONS: { value: CompetitionCreateStatus; hint: string }[] = [
  { value: "OPEN", hint: "Les clubs Pro Clubs gérés peuvent s'inscrire." },
  { value: "DRAFT", hint: "Visible seulement par toi tant qu'elle n'est pas ouverte." },
];

export function CreateCompetitionForm({ onCreated }: { onCreated?: (competition: CompetitionRow) => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<CompetitionCreateStatus>("OPEN");
  const mutation = useCreateCompetition(session?.user.id ?? "");

  const submit = () => {
    if (!session || !name.trim()) {
      toast.error("Le nom de la compétition est requis.");
      return;
    }
    mutation.mutate(
      { name: name.trim(), status },
      {
        onSuccess: (competition) => {
          toast.success(COMPETITION_COPY.created);
          setName("");
          setStatus("OPEN");
          onCreated?.(competition);
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Erreur");
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{COMPETITION_COPY.create}</CardTitle>
      </CardHeader>
      <View className="gap-3">
        <View>
          <Label>{COMPETITION_COPY.nameLabel}</Label>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={COMPETITION_COPY.namePlaceholder}
            maxLength={80}
            accessibilityLabel={COMPETITION_COPY.nameLabel}
          />
        </View>
        <View>
          <Label>{COMPETITION_COPY.statusLabel}</Label>
          <View className="gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setStatus(opt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={COMPETITION_STATUS_LABELS[opt.value]}
                  className={`min-h-[44px] justify-center rounded-xl border px-3 py-2 ${
                    active ? "border-accent bg-accent/15" : "border-border bg-bg-elevated"
                  }`}
                >
                  <Text className={`text-sm font-bold ${active ? "text-accent" : "text-fg"}`}>
                    {COMPETITION_STATUS_LABELS[opt.value]}
                  </Text>
                  <Text className="text-xs text-fg-muted">{opt.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Button loading={mutation.isPending} onPress={submit}>
          {COMPETITION_COPY.createCta}
        </Button>
      </View>
    </Card>
  );
}

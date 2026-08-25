import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateTournament } from "@/lib/hooks/useTournaments";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";
import {
  TOURNAMENT_COPY,
  TOURNAMENT_STATUS_LABELS,
  type TournamentCreateStatus,
} from "@/lib/tournaments";
import type { CompetitionRow } from "@/lib/types";

const STATUS_OPTIONS: { value: TournamentCreateStatus; hint: string }[] = [
  { value: "OPEN", hint: TOURNAMENT_COPY.openCreateHint },
  { value: "DRAFT", hint: TOURNAMENT_COPY.draftCreateHint },
];

export function CreateTournamentForm({ onCreated }: { onCreated?: (tournament: CompetitionRow) => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<TournamentCreateStatus>("OPEN");
  const mutation = useCreateTournament(session?.user.id ?? "");
  const canSubmit = Boolean(session) && name.trim().length > 0 && !mutation.isPending;

  const submit = () => {
    if (!session || !name.trim()) {
      toast.error("Le nom du tournoi est requis.");
      return;
    }
    mutation.mutate(
      { name: name.trim(), status },
      {
        onSuccess: (tournament) => {
          toast.success(TOURNAMENT_COPY.created);
          setName("");
          setStatus("OPEN");
          onCreated?.(tournament);
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
        <CardTitle>{TOURNAMENT_COPY.create}</CardTitle>
      </CardHeader>
      <Text className="mb-3 text-xs text-fg-muted">{TOURNAMENT_COPY.createOwnerHint}</Text>
      <View className="gap-3">
        <View>
          <Label>{TOURNAMENT_COPY.nameLabel}</Label>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={TOURNAMENT_COPY.namePlaceholder}
            maxLength={80}
            accessibilityLabel={TOURNAMENT_COPY.nameLabel}
          />
        </View>
        <View>
          <Label>{TOURNAMENT_COPY.statusLabel}</Label>
          <View className="gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setStatus(opt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={TOURNAMENT_STATUS_LABELS[opt.value]}
                  className={`min-h-[44px] justify-center rounded-xl border px-3 py-2 ${
                    active ? "border-accent bg-accent/15" : "border-border bg-bg-elevated"
                  }`}
                >
                  <Text className={`text-sm font-bold ${active ? "text-accent" : "text-fg"}`}>
                    {TOURNAMENT_STATUS_LABELS[opt.value]}
                  </Text>
                  <Text className="text-xs text-fg-muted">{opt.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {status === "DRAFT" ? (
          <Text className="text-xs text-fg-muted">{TOURNAMENT_COPY.draftCannotRegister}</Text>
        ) : null}
        {mutation.isError ? (
          <Text className="text-xs text-danger">
            {mutation.error instanceof Error ? mutation.error.message : TOURNAMENT_COPY.loadError}
          </Text>
        ) : null}
        <Button loading={mutation.isPending} disabled={!canSubmit} onPress={submit}>
          {TOURNAMENT_COPY.createCta}
        </Button>
      </View>
    </Card>
  );
}

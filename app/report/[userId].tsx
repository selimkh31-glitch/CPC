import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { Label, Textarea } from "@/components/ui/Input";
import { useUserProfile } from "@/lib/hooks/useProfile";
import { useReportUser } from "@/lib/hooks/useSafety";
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@/lib/safety";
import { toast } from "@/lib/toast";

const REASON_OPTIONS = REPORT_REASONS.map((value) => ({ value, label: REPORT_REASON_LABELS[value] }));

export default function ReportUserScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { data: user, isLoading, isError, refetch } = useUserProfile(userId ?? null);
  const report = useReportUser();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!userId) {
    return (
      <Screen>
        <EmptyState title="Joueur introuvable." />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-32" />
      </Screen>
    );
  }

  if (isError || !user) {
    return (
      <Screen>
        <ErrorState message="Impossible de charger ce joueur." onRetry={refetch} />
      </Screen>
    );
  }

  if (submitted) {
    return (
      <Screen>
        <EmptyState
          title="Signalement enregistré."
          subtitle="Il reste ouvert pour la modération. Tu peux le retrouver dans Bloqués & signalements."
        />
        <View className="mt-4">
          <Button variant="secondary" onPress={() => router.replace("/blocked")}>
            Voir mes signalements
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="mb-1 font-display text-2xl text-fg">Signaler {user.username}</Text>
      <Text className="mb-4 text-sm text-fg-muted">
        Contexte EA SPORTS FC 27 Pro Clubs uniquement. Le signalement est persisté (statut OPEN) pour la modération.
      </Text>

      <Label>Motif</Label>
      <ChipSelect
        single
        options={REASON_OPTIONS}
        value={reason ? [reason] : []}
        onChange={(next) => setReason((next[0] as ReportReason | undefined) ?? "")}
      />

      <View className="mt-4">
        <Label>Détails (optionnel)</Label>
        <Textarea
          value={details}
          onChangeText={setDetails}
          maxLength={2000}
          placeholder="Décris le comportement en Pro Clubs…"
        />
      </View>

      <View className="mt-6">
        <Button
          disabled={!reason}
          loading={report.isPending}
          onPress={() => {
            if (!reason) return;
            report.mutate(
              { userId, reason, details: details.trim() || undefined },
              {
                onSuccess: () => setSubmitted(true),
                onError: (err: any) => toast.error(err.message ?? "Impossible d'envoyer le signalement."),
              }
            );
          }}
        >
          Envoyer le signalement
        </Button>
      </View>
    </Screen>
  );
}

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CompetitionLinkedMatches } from "@/components/competitions/CompetitionLinkedMatches";
import { CompetitionParticipants } from "@/components/competitions/CompetitionParticipants";
import { CompetitionRegisterCta } from "@/components/competitions/CompetitionRegisterCta";
import { CompetitionStandings } from "@/components/competitions/CompetitionStandings";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyClubs } from "@/lib/hooks/useClubs";
import { useCompetition, useRegisterCompetitionClub } from "@/lib/hooks/useCompetitions";
import { useCompetitionLinkedResults } from "@/lib/hooks/useCompetitionResults";
import { toast } from "@/lib/toast";
import {
  COMPETITION_COPY,
  COMPETITION_STATUS_LABELS,
  competitionCreatorLabel,
  competitionRegisterCtaKind,
  type CompetitionStatus,
} from "@/lib/competitions";
import { tournamentDetailHref } from "@/lib/tournaments";

function statusTone(status: CompetitionStatus): "accent" | "neutral" | "warn" {
  if (status === "OPEN") return "accent";
  if (status === "CLOSED") return "warn";
  return "neutral";
}

/**
 * Détail d'une compétition — stack `/competitions/[id]`, pas un onglet.
 * Statut, créateur, participants réels, classement lié, CTA inscrire si éligible.
 */
export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const competitionId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : null;
  const { session } = useAuth();
  const { data: competition, isLoading, isError, refetch } = useCompetition(competitionId);
  const { data: managedClubs } = useMyClubs(session?.user.id ?? null);
  const register = useRegisterCompetitionClub();
  const clubs = managedClubs ?? [];
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const clubId = selectedClubId ?? clubs[0]?.id ?? null;
  const selectedClub = clubs.find((c) => c.id === clubId) ?? null;
  const linkedIds = useMemo(() => (competitionId ? [competitionId] : []), [competitionId]);
  const linkedResults = useCompetitionLinkedResults(linkedIds);
  const managedClubIds = useMemo(() => (managedClubs ?? []).map((club) => club.id), [managedClubs]);

  if (isLoading) {
    return (
      <View className="flex-1 gap-3 bg-bg p-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-bg p-4">
        <ErrorState message={COMPETITION_COPY.detailLoadError} onRetry={refetch} />
      </View>
    );
  }

  if (!competition) {
    return (
      <View className="flex-1 bg-bg p-4">
        <EmptyState
          title={COMPETITION_COPY.competitionNotFound}
          subtitle={COMPETITION_COPY.subtitle}
        />
      </View>
    );
  }

  if (competition.kind === "TOURNAMENT") {
    return <Redirect href={tournamentDetailHref(competition.id)} />;
  }

  const registeredIds = (competition.clubs ?? []).map((row) => row.club_id);
  const already = selectedClub ? registeredIds.includes(selectedClub.id) : false;
  const kind = competitionRegisterCtaKind({
    status: competition.status,
    hasManagedClub: Boolean(selectedClub),
    alreadyRegistered: already,
  });
  const creator = competitionCreatorLabel(competition, session?.user.id ?? null);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: competition.name }} />
      <Card className="mb-4">
        <View className="mb-3 flex-row items-start justify-between gap-2">
          <Text className="min-w-0 flex-1 font-display text-2xl text-fg">{competition.name}</Text>
          <Badge tone={statusTone(competition.status)}>{COMPETITION_STATUS_LABELS[competition.status]}</Badge>
        </View>
        <Text className="text-xs text-fg-subtle">
          {COMPETITION_COPY.creatorLabel} · {creator}
        </Text>
        {competition.status === "OPEN" ? (
          <Text className="mt-2 text-xs text-fg-muted">{COMPETITION_COPY.openJoinHint}</Text>
        ) : null}
      </Card>

      {clubs.length > 1 ? (
        <View className="mb-4">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
            Club Pro Clubs à inscrire
          </Text>
          <View className="gap-2">
            {clubs.map((club) => {
              const active = club.id === clubId;
              return (
                <Pressable
                  key={club.id}
                  onPress={() => setSelectedClubId(club.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={club.name}
                  className={`min-h-[44px] justify-center rounded-xl border px-3 ${
                    active ? "border-accent bg-accent/15" : "border-border bg-bg-elevated"
                  }`}
                >
                  <Text className={`text-sm font-bold ${active ? "text-accent" : "text-fg"}`}>{club.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Card className="mb-4">
        <CompetitionParticipants clubs={competition.clubs} />
        <View className="mt-3">
          <CompetitionRegisterCta
            kind={kind}
            clubName={selectedClub?.name}
            loading={register.isPending}
            showNoManagedClub
            onRegister={() => {
              if (!selectedClub) {
                toast.error(COMPETITION_COPY.noManagedClub);
                return;
              }
              register.mutate(
                { competitionId: competition.id, clubId: selectedClub.id },
                {
                  onSuccess: () => toast.success(COMPETITION_COPY.registered),
                  onError: (err: unknown) => {
                    toast.error(err instanceof Error ? err.message : "Erreur");
                  },
                }
              );
            }}
          />
        </View>
      </Card>

      <Card className="mb-4">
        <CompetitionLinkedMatches
          competition={competition}
          results={linkedResults.data}
          isLoading={linkedResults.isLoading}
          isError={linkedResults.isError}
          onRetry={() => linkedResults.refetch()}
          managedClubIds={managedClubIds}
        />
      </Card>

      <Card>
        <CompetitionStandings
          competition={competition}
          results={linkedResults.data}
          isLoading={linkedResults.isLoading}
          isError={linkedResults.isError}
          onRetry={() => linkedResults.refetch()}
        />
      </Card>
    </ScrollView>
  );
}

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CompetitionParticipants } from "@/components/competitions/CompetitionParticipants";
import { CompetitionRegisterCta } from "@/components/competitions/CompetitionRegisterCta";
import { TournamentBracket } from "@/components/tournaments/TournamentBracket";
import { TournamentProgression } from "@/components/tournaments/TournamentProgression";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyClubs } from "@/lib/hooks/useClubs";
import { useRegisterCompetitionClub } from "@/lib/hooks/useCompetitions";
import { useCompetitionLinkedResults } from "@/lib/hooks/useCompetitionResults";
import { useScheduleTournamentRound, useTournament, useTournamentMatches } from "@/lib/hooks/useTournaments";
import { toast } from "@/lib/toast";
import { competitionCreatorLabel, competitionDetailHref, competitionRegisterCtaKind, type CompetitionStatus } from "@/lib/competitions";
import { TOURNAMENT_COPY, TOURNAMENT_STATUS_LABELS } from "@/lib/tournaments";

function statusTone(status: CompetitionStatus): "accent" | "neutral" | "warn" {
  if (status === "OPEN") return "accent";
  if (status === "CLOSED") return "warn";
  return "neutral";
}

/**
 * Détail d'un tournoi — stack `/tournaments/[id]`, pas un onglet.
 * Tableau = tournament_matches persistés. Scores = match_results liés.
 */
export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : null;
  const { session } = useAuth();
  const { data: tournament, isLoading, isError, refetch } = useTournament(tournamentId);
  const matchesQuery = useTournamentMatches(tournamentId);
  const { data: managedClubs } = useMyClubs(session?.user.id ?? null);
  const register = useRegisterCompetitionClub();
  const schedule = useScheduleTournamentRound();
  const clubs = managedClubs ?? [];
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const clubId = selectedClubId ?? clubs[0]?.id ?? null;
  const selectedClub = clubs.find((c) => c.id === clubId) ?? null;
  const linkedIds = useMemo(() => (tournamentId ? [tournamentId] : []), [tournamentId]);
  const linkedResults = useCompetitionLinkedResults(linkedIds);

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
        <ErrorState message={TOURNAMENT_COPY.detailLoadError} onRetry={refetch} />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View className="flex-1 bg-bg p-4">
        <EmptyState title={TOURNAMENT_COPY.tournamentNotFound} subtitle={TOURNAMENT_COPY.subtitle} />
      </View>
    );
  }

  if (tournament.kind && tournament.kind !== "TOURNAMENT") {
    return <Redirect href={competitionDetailHref(tournament.id)} />;
  }

  const registeredIds = (tournament.clubs ?? []).map((row) => row.club_id);
  const already = selectedClub ? registeredIds.includes(selectedClub.id) : false;
  const kind = competitionRegisterCtaKind({
    status: tournament.status,
    hasManagedClub: Boolean(selectedClub),
    alreadyRegistered: already,
  });
  const creator = competitionCreatorLabel(tournament, session?.user.id ?? null);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: tournament.name }} />
      <Card className="mb-4">
        <View className="mb-3 flex-row items-start justify-between gap-2">
          <Text className="min-w-0 flex-1 font-display text-2xl text-fg">{tournament.name}</Text>
          <Badge tone={statusTone(tournament.status)}>{TOURNAMENT_STATUS_LABELS[tournament.status]}</Badge>
        </View>
        <Text className="text-xs text-fg-subtle">
          {TOURNAMENT_COPY.creatorLabel} · {creator}
        </Text>
        {tournament.status === "OPEN" ? (
          <Text className="mt-2 text-xs text-fg-muted">{TOURNAMENT_COPY.openJoinHint}</Text>
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
        <CompetitionParticipants clubs={tournament.clubs} />
        <View className="mt-3">
          <CompetitionRegisterCta
            kind={kind}
            clubName={selectedClub?.name}
            loading={register.isPending}
            showNoManagedClub
            alreadyRegisteredLabel={TOURNAMENT_COPY.alreadyRegistered}
            draftLabel={TOURNAMENT_COPY.draftCannotRegister}
            closedLabel={TOURNAMENT_COPY.closedCannotRegister}
            noManagedClubLabel={TOURNAMENT_COPY.noManagedClub}
            registerCtaLabel={TOURNAMENT_COPY.registerCta}
            onRegister={() => {
              if (!selectedClub) {
                toast.error(TOURNAMENT_COPY.noManagedClub);
                return;
              }
              register.mutate(
                { competitionId: tournament.id, clubId: selectedClub.id },
                {
                  onSuccess: () => toast.success(TOURNAMENT_COPY.registered),
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
        <TournamentBracket
          tournament={tournament}
          matches={matchesQuery.data}
          results={linkedResults.data}
          viewerId={session?.user.id ?? null}
          isLoading={matchesQuery.isLoading}
          isError={matchesQuery.isError}
          onRetry={() => matchesQuery.refetch()}
          scheduling={schedule.isPending}
          onSchedule={() => {
            schedule.mutate(
              { tournamentId: tournament.id },
              {
                onSuccess: () => toast.success(TOURNAMENT_COPY.scheduled),
                onError: (err: unknown) => {
                  toast.error(err instanceof Error ? err.message : "Erreur");
                },
              }
            );
          }}
        />
      </Card>

      <Card>
        <TournamentProgression
          tournament={tournament}
          matches={matchesQuery.data}
          results={linkedResults.data}
        />
      </Card>
    </ScrollView>
  );
}

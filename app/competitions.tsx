import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Plus, Trophy } from "lucide-react-native";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CreateCompetitionForm } from "@/components/competitions/CreateCompetitionForm";
import { CompetitionStandings } from "@/components/competitions/CompetitionStandings";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyClubs } from "@/lib/hooks/useClubs";
import { useCompetitions, useRegisterCompetitionClub } from "@/lib/hooks/useCompetitions";
import { useCompetitionLinkedResults, type LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import { toast } from "@/lib/toast";
import {
  COMPETITION_COPY,
  COMPETITION_STATUS_LABELS,
  type CompetitionStatus,
} from "@/lib/competitions";
import type { ClubRow, CompetitionRow } from "@/lib/types";

/**
 * Compétitions virtuelles EA SPORTS FC 27 Pro Clubs — stack, pas un onglet.
 * Ligues (`/leagues`) reste hors tab bar. Classement seulement si des
 * `match_results` liés existent (competition_id + opponent_club_id).
 */
export default function CompetitionsScreen() {
  const { session } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const { data: competitions, isLoading, isError, refetch } = useCompetitions();
  const { data: managedClubs } = useMyClubs(session?.user.id ?? null);
  const register = useRegisterCompetitionClub();
  const clubs = managedClubs ?? [];
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const clubId = selectedClubId ?? clubs[0]?.id ?? null;
  const selectedClub = clubs.find((c) => c.id === clubId) ?? null;
  const competitionIds = useMemo(() => (competitions ?? []).map((c) => c.id), [competitions]);
  const linkedResults = useCompetitionLinkedResults(competitionIds);

  const clubOptions = useMemo(
    () => clubs.map((c) => ({ id: c.id, name: c.name })),
    [clubs]
  );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-4 flex-row items-center justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <View className="flex-row items-center gap-2">
            <Trophy size={20} color="#39ff8a" />
            <Text className="font-display text-2xl text-fg">{COMPETITION_COPY.title}</Text>
          </View>
          <Text className="mt-1 text-xs text-fg-subtle">{COMPETITION_COPY.subtitle}</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => {
            Haptics.selectionAsync();
            setShowCreate((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel={showCreate ? "Annuler la création" : COMPETITION_COPY.create}
          className="min-h-[44px] min-w-[44px] flex-row items-center gap-1 px-2"
        >
          <Plus size={16} color="#39ff8a" />
          <Text className="text-sm font-bold text-accent">{showCreate ? "Annuler" : "Créer"}</Text>
        </Pressable>
      </View>

      {showCreate && (
        <View className="mb-6">
          <CreateCompetitionForm onCreated={() => setShowCreate(false)} />
        </View>
      )}

      {clubs.length > 1 && (
        <View className="mb-4">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
            Club Pro Clubs à inscrire
          </Text>
          <View className="gap-2">
            {clubOptions.map((club) => {
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
      )}

      {clubs.length === 0 && (
        <Text className="mb-4 text-xs text-fg-muted">{COMPETITION_COPY.noManagedClub}</Text>
      )}

      {isLoading ? (
        <View className="gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </View>
      ) : isError ? (
        <ErrorState message={COMPETITION_COPY.loadError} onRetry={refetch} />
      ) : !competitions || competitions.length === 0 ? (
        <EmptyState title={COMPETITION_COPY.empty} subtitle={COMPETITION_COPY.emptyHint} />
      ) : (
        <View className="gap-2">
          {competitions.map((competition) => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              managedClub={selectedClub}
              registering={register.isPending}
              linkedResults={linkedResults.data}
              linkedLoading={linkedResults.isLoading}
              linkedError={linkedResults.isError}
              onRetryLinked={() => linkedResults.refetch()}
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
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function statusTone(status: CompetitionStatus): "accent" | "neutral" | "warn" {
  if (status === "OPEN") return "accent";
  if (status === "CLOSED") return "warn";
  return "neutral";
}

function CompetitionCard({
  competition,
  managedClub,
  registering,
  linkedResults,
  linkedLoading,
  linkedError,
  onRetryLinked,
  onRegister,
}: {
  competition: CompetitionRow;
  managedClub: ClubRow | null;
  registering: boolean;
  linkedResults: LinkedMatchResultRow[] | undefined;
  linkedLoading: boolean;
  linkedError: boolean;
  onRetryLinked: () => void;
  onRegister: () => void;
}) {
  const registeredIds = (competition.clubs ?? []).map((row) => row.club_id);
  const already = managedClub ? registeredIds.includes(managedClub.id) : false;
  const canRegister = competition.status === "OPEN" && Boolean(managedClub) && !already;

  return (
    <Card>
      <View className="mb-2 flex-row items-start justify-between gap-2">
        <Text className="min-w-0 flex-1 font-display text-lg text-fg">{competition.name}</Text>
        <Badge tone={statusTone(competition.status)}>{COMPETITION_STATUS_LABELS[competition.status]}</Badge>
      </View>
      {(competition.clubs ?? []).length === 0 ? (
        <Text className="mb-3 text-xs text-fg-muted">Aucun club Pro Clubs inscrit.</Text>
      ) : (
        <View className="mb-3 gap-1">
          {(competition.clubs ?? []).map((row) => (
            <Text key={row.id} className="text-sm text-fg">
              {row.club?.name ?? "Club Pro Clubs"}
            </Text>
          ))}
        </View>
      )}
      {canRegister ? (
        <Button loading={registering} onPress={onRegister} variant="secondary">
          {`Inscrire ${managedClub!.name}`}
        </Button>
      ) : already ? (
        <Text className="text-xs font-bold text-accent">{COMPETITION_COPY.alreadyRegistered}</Text>
      ) : null}
      <CompetitionStandings
        competition={competition}
        results={linkedResults}
        isLoading={linkedLoading}
        isError={linkedError}
        onRetry={onRetryLinked}
      />
    </Card>
  );
}

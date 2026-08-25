import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Plus, Trophy } from "lucide-react-native";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { CreateTournamentForm } from "@/components/tournaments/CreateTournamentForm";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyClubs } from "@/lib/hooks/useClubs";
import { useRegisterCompetitionClub } from "@/lib/hooks/useCompetitions";
import { useTournaments } from "@/lib/hooks/useTournaments";
import { toast } from "@/lib/toast";
import { TOURNAMENT_COPY, tournamentDetailHref } from "@/lib/tournaments";

/**
 * Tournois virtuels EA SPORTS FC 27 Pro Clubs — stack, pas un onglet.
 * Ligues (`/leagues`) reste hors tab bar. Tableau seulement depuis des
 * `tournament_matches` persistés ; scores seulement depuis `match_results` liés.
 */
export default function TournamentsScreen() {
  const { session } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const { data: tournaments, isLoading, isError, refetch } = useTournaments();
  const { data: managedClubs } = useMyClubs(session?.user.id ?? null);
  const register = useRegisterCompetitionClub();
  const clubs = managedClubs ?? [];
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const clubId = selectedClubId ?? clubs[0]?.id ?? null;
  const selectedClub = clubs.find((c) => c.id === clubId) ?? null;

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
            <Text className="font-display text-2xl text-fg">{TOURNAMENT_COPY.title}</Text>
          </View>
          <Text className="mt-1 text-xs text-fg-subtle">{TOURNAMENT_COPY.subtitle}</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => {
            Haptics.selectionAsync();
            setShowCreate((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel={showCreate ? "Annuler la création" : TOURNAMENT_COPY.create}
          className="min-h-[44px] min-w-[44px] flex-row items-center gap-1 px-2"
        >
          <Plus size={16} color="#39ff8a" />
          <Text className="text-sm font-bold text-accent">{showCreate ? "Annuler" : "Créer"}</Text>
        </Pressable>
      </View>

      {showCreate && (
        <View className="mb-6">
          <CreateTournamentForm
            onCreated={(tournament) => {
              setShowCreate(false);
              router.push(tournamentDetailHref(tournament.id));
            }}
          />
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
        <Text className="mb-4 text-xs text-fg-muted">{TOURNAMENT_COPY.noManagedClub}</Text>
      )}

      {isLoading ? (
        <View className="gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </View>
      ) : isError ? (
        <ErrorState message={TOURNAMENT_COPY.loadError} onRetry={refetch} />
      ) : !tournaments || tournaments.length === 0 ? (
        <EmptyState title={TOURNAMENT_COPY.empty} subtitle={TOURNAMENT_COPY.emptyHint} />
      ) : (
        <View className="gap-2">
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              managedClub={selectedClub}
              viewerId={session?.user.id ?? null}
              registering={register.isPending}
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
          ))}
        </View>
      )}
    </ScrollView>
  );
}

import { useCallback, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { MembersPanel } from "@/components/club/MembersPanel";
import { DeparturesPanel } from "@/components/club/DeparturesPanel";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { ClubCard } from "@/components/club/ClubCard";
import { SocialShortcuts } from "@/components/social/SocialShortcuts";
import { StartClubConversationButton } from "@/components/social/StartClubConversationButton";
import { CompetitionsLink } from "@/components/competitions/CompetitionsLink";
import { TournamentsLink } from "@/components/tournaments/TournamentsLink";
import { LeaguesLink } from "@/components/leagues/LeaguesLink";
import { MatchHistoryList } from "@/components/profile/MatchHistoryList";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useClubMatchHistory } from "@/lib/hooks/useMatchHistory";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { canEditClubIdentity } from "@/lib/clubIdentity";
import { buildClubCardDataFromHydratedClub } from "@/lib/clubCard";
import { canMutateClub } from "@/lib/sessionState";

/**
 * Club — identité + stats réelles. Recrutement LIVE et invitations sont ailleurs.
 * Lien EA club : affiché si `ea_club_id` existe (ingest) — pas de bouton mort.
 */
export default function ClubTab() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { setMode } = useAppMode();
  const { data: club, isLoading, isError, refetch, isFetching } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
  const {
    data: matchHistory,
    isLoading: matchHistoryLoading,
    isError: matchHistoryError,
    refetch: refetchMatchHistory,
  } = useClubMatchHistory(club?.id ?? null, club?.name);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }} keyboardShouldPersistTaps="handled">
        <ModeSwitch managedClubs={managedClubs} />
        {body}
      </ScrollView>
    </SafeAreaView>
  );

  if (isLoading || (isFetching && !club && !isError)) {
    return shell(<Skeleton className="h-40" />);
  }

  if (isError) {
    return shell(<ErrorState message="Impossible de charger ce club." onRetry={refetch} />);
  }

  if (!club) {
    return shell(
      <View className="gap-4">
        <EmptyState
          title="Aucun club géré"
          subtitle="Crée un club EA SPORTS FC 27 Pro Clubs en mode Joueur, ou fais-toi nommer manager."
        />
        <Button
          variant="secondary"
          onPress={() => {
            setMode("PLAYER");
            router.push("/create-club");
          }}
        >
          Créer un club
        </Button>
        <Button variant="ghost" onPress={() => setMode("PLAYER")}>
          Retour mode Joueur
        </Button>
      </View>
    );
  }

  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const canManage = canMutateClub(myMembership?.role);
  const isOwner = canEditClubIdentity(club.owner_id, session?.user.id);

  return shell(
    <>
      <ClubCard
        data={buildClubCardDataFromHydratedClub(club, {
          members: club.members,
          sessions: club.sessions,
          nowMs: now,
        })}
        variant="full"
        interactive={false}
        footer={
          <View className="gap-3">
            {isOwner ? (
              <Pressable
                onPress={() => router.push("/edit-club")}
                className="min-h-[44px] self-start justify-center"
                accessibilityRole="button"
                accessibilityLabel="Modifier le club"
              >
                <Text className="text-sm text-fg-subtle">Modifier le club</Text>
              </Pressable>
            ) : null}
            <StartClubConversationButton clubId={club.id} role={myMembership?.role} clubName={club.name} />
          </View>
        }
      />

      <MatchHistoryList
        items={matchHistory}
        loading={matchHistoryLoading}
        error={matchHistoryError}
        onRetry={refetchMatchHistory}
      />

      <MembersPanel
        clubId={club.id}
        clubName={club.name}
        isOwner={isOwner}
        canManage={canManage}
        members={club.members ?? []}
      />
      {canManage && <DeparturesPanel clubId={club.id} members={club.members ?? []} />}

      <View className="gap-2">
        <SocialShortcuts />
        <CompetitionsLink />
        <TournamentsLink />
        <LeaguesLink />
      </View>
    </>
  );
}

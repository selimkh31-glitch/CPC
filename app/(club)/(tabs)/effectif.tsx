import { useCallback, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { MembersPanel } from "@/components/club/MembersPanel";
import { DeparturesPanel } from "@/components/club/DeparturesPanel";
import { ModeLifeToggle } from "@/components/club/ModeLifeToggle";
import { DevTestAccountSwitcher } from "@/components/profile/DevTestAccountSwitcher";
import { ManagedClubEmpty } from "@/components/club/ManagedClubEmpty";
import { ClubCard } from "@/components/club/ClubCard";
import { SocialShortcuts } from "@/components/social/SocialShortcuts";
import { StartClubConversationButton } from "@/components/social/StartClubConversationButton";
import { CompetitionsLink } from "@/components/competitions/CompetitionsLink";
import { TournamentsLink } from "@/components/tournaments/TournamentsLink";
import { LeaguesLink } from "@/components/leagues/LeaguesLink";
import { MatchHistoryList } from "@/components/profile/MatchHistoryList";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useClubMatchHistory } from "@/lib/hooks/useMatchHistory";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { canEditClubIdentity } from "@/lib/clubIdentity";
import { buildClubCardDataFromHydratedClub } from "@/lib/clubCard";
import { canMutateClub } from "@/lib/sessionState";

/**
 * Club — identité manager. Recrutement LIVE et invitations sont ailleurs.
 * Seule bascule « Passer en joueur » : ici, pas dans LIVE / Recrutement / tabs.
 */
export default function ClubTab() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const {
    data: matchHistory,
    isLoading: matchHistoryLoading,
    isError: matchHistoryError,
    refetch: refetchMatchHistory,
  } = useClubMatchHistory(club?.id ?? null, club?.name);

  useFocusEffect(
    useCallback(() => {
      if (!club) return;
      refetch();
    }, [club, refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </SafeAreaView>
  );

  if (isLoading) {
    return shell(<Skeleton className="h-40" />);
  }

  if (!club) {
    return shell(
      <ManagedClubEmpty
        extras={
          <>
            <ModeLifeToggle target="PLAYER" />
            <DevTestAccountSwitcher />
          </>
        }
      />
    );
  }

  if (isError) {
    return shell(
      <View className="gap-4">
        <ErrorState message="Impossible de charger ce club." onRetry={refetch} />
        <ModeLifeToggle target="PLAYER" />
        <DevTestAccountSwitcher />
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

      <ModeLifeToggle target="PLAYER" />
      <DevTestAccountSwitcher />

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

import { useCallback, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Pencil } from "lucide-react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { MembersPanel } from "@/components/club/MembersPanel";
import { DeparturesPanel } from "@/components/club/DeparturesPanel";
import { InviteToClubPanel } from "@/components/club/InviteToClubPanel";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { ClubIdentityHeader } from "@/components/club/ClubIdentityHeader";
import { ClubSessionStatus } from "@/components/club/ClubSessionStatus";
import { SocialShortcuts } from "@/components/social/SocialShortcuts";
import { StartClubConversationButton } from "@/components/social/StartClubConversationButton";
import { CompetitionsLink } from "@/components/competitions/CompetitionsLink";
import { TournamentsLink } from "@/components/tournaments/TournamentsLink";
import { LeaguesLink } from "@/components/leagues/LeaguesLink";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useActiveMatchCheckin } from "@/lib/hooks/useMatchCheckin";
import { canEditClubIdentity } from "@/lib/clubIdentity";
import { clubOwnerPlatform, clubOwnerUsername } from "@/lib/clubProfile";
import { canMutateClub, clubSessionSnapshot } from "@/lib/sessionState";

/**
 * Club — identité, effectif réel, réglages. Feuille de match en push `/match` (secondaire).
 */
export default function ClubTab() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { setMode } = useAppMode();
  const { data: club, isLoading, isError, refetch, isFetching } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
  const {
    data: activeCheckin,
    isLoading: checkinLoading,
    isError: checkinError,
    refetch: refetchCheckin,
  } = useActiveMatchCheckin(club?.id ?? null);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
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
        <CompetitionsLink />
        <TournamentsLink />
        <LeaguesLink />
      </View>
    );
  }

  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const canManage = canMutateClub(myMembership?.role);
  const snapshot = clubSessionSnapshot(club.sessions, activeCheckin ?? null, now);
  const isOwner = canEditClubIdentity(club.owner_id, session?.user.id);

  return shell(
    <>
      <ClubIdentityHeader
        name={club.name}
        level={club.level}
        ownerPlatform={clubOwnerPlatform(club.members)}
        ownerUsername={clubOwnerUsername(club.members)}
        languages={club.languages}
        description={club.description}
      />
      {isOwner ? (
        <Button
          variant="secondary"
          className="min-h-[44px] w-full"
          icon={<Pencil size={15} color="#f4f5f7" />}
          accessibilityLabel="Modifier l'identité du club"
          onPress={() => router.push("/edit-club")}
        >
          Modifier l'identité du club
        </Button>
      ) : null}

      <ClubSessionStatus
        snapshot={snapshot}
        checkinLoading={checkinLoading}
        checkinError={checkinError}
        onRetryCheckin={() => refetchCheckin()}
        matchSheetCta={{
          label: snapshot.match.active ? "Ouvrir la feuille de match" : "Feuille de match",
          onPress: () => router.push("/match"),
        }}
      />
      <StartClubConversationButton clubId={club.id} role={myMembership?.role} />
      <SocialShortcuts />
      <CompetitionsLink />
      <TournamentsLink />
      <LeaguesLink />
      <MembersPanel
        clubId={club.id}
        clubName={club.name}
        isOwner={isOwner}
        canManage={canManage}
        members={club.members ?? []}
      />
      {canManage && <DeparturesPanel clubId={club.id} members={club.members ?? []} />}
      {canManage && <InviteToClubPanel clubId={club.id} members={club.members ?? []} />}
    </>
  );
}

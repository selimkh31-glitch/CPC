import { type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { ApplicationsPanel } from "@/components/club/ApplicationsPanel";
import { ClubInvitationsPanel } from "@/components/club/ClubInvitationsPanel";
import { InviteToClubPanel } from "@/components/club/InviteToClubPanel";
import { ManagedClubEmpty } from "@/components/club/ManagedClubEmpty";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { managedClubScreenState } from "@/lib/clubRead";

/**
 * Recrutement — postuler arrive du LIVE joueur ; ici : accepter / refuser / inviter.
 */
export default function RecrutementTab() {
  const { data: club, isLoading, isError, refetch, isFetching, clubId } = useManagedClub();
  const screen = managedClubScreenState({ clubId, club, isLoading, isFetching, isError });

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
        {body}
      </ScrollView>
    </SafeAreaView>
  );

  if (screen === "loading") {
    return shell(<Skeleton className="h-40" />);
  }

  if (screen === "error") {
    return shell(<ErrorState message="Impossible de charger ce club." onRetry={refetch} />);
  }

  if (screen === "empty" || !club) {
    return shell(<ManagedClubEmpty />);
  }

  return shell(
    <>
      <View>
        <Text className="font-display text-2xl text-fg">Recrutement</Text>
        <Text className="mt-0.5 text-sm text-fg-muted">Accepte, refuse ou invite.</Text>
      </View>
      <ApplicationsPanel clubId={club.id} />
      <InviteToClubPanel clubId={club.id} members={club.members ?? []} />
      <ClubInvitationsPanel clubId={club.id} />
    </>
  );
}

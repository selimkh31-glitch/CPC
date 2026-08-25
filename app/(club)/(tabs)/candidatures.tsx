import { type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { ApplicationsPanel } from "@/components/club/ApplicationsPanel";
import { ClubInvitationsPanel } from "@/components/club/ClubInvitationsPanel";
import { InviteToClubPanel } from "@/components/club/InviteToClubPanel";
import { useManagedClub } from "@/lib/hooks/useManagedClub";

/**
 * Recrutement — postuler arrive du LIVE joueur ; ici : accepter / refuser / inviter.
 */
export default function RecrutementTab() {
  const { data: club, isLoading, isError, refetch } = useManagedClub();

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
        {body}
      </ScrollView>
    </SafeAreaView>
  );

  if (isLoading) {
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
          subtitle="Crée un club, ou fais-toi nommer manager."
        />
        <Button className="min-h-[48px]" onPress={() => router.push("/create-club")}>
          Créer un club
        </Button>
      </View>
    );
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

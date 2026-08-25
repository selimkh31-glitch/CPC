import { type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { ApplicationsPanel } from "@/components/club/ApplicationsPanel";
import { ClubInvitationsPanel } from "@/components/club/ClubInvitationsPanel";
import { InviteToClubPanel } from "@/components/club/InviteToClubPanel";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";

/**
 * Recrutement — postuler arrive du LIVE joueur ; ici : accepter / refuser / inviter.
 */
export default function RecrutementTab() {
  const { session } = useAuth();
  const { setMode } = useAppMode();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
        <ModeSwitch managedClubs={managedClubs} />
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
          subtitle="Crée un club EA SPORTS FC 27 Pro Clubs en mode Joueur, ou fais-toi nommer manager."
        />
        <Button variant="ghost" onPress={() => setMode("PLAYER")}>
          Retour mode Joueur
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

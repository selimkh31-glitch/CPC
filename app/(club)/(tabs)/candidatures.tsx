import { type ReactNode } from "react";
import { Text, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { AppShell } from "@/components/nav/AppShell";
import { ApplicationsPanel } from "@/components/club/ApplicationsPanel";
import { ClubInvitationsPanel } from "@/components/club/ClubInvitationsPanel";
import { InviteToClubPanel } from "@/components/club/InviteToClubPanel";
import { ManagedClubEmpty } from "@/components/club/ManagedClubEmpty";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { cpcTokens } from "@/lib/design/cpc-tokens";

/**
 * Recrutement — postuler arrive du LIVE joueur ; ici : accepter / refuser / inviter.
 */
export default function RecrutementTab() {
  const { data: club, isLoading, isError, refetch } = useManagedClub();

  const shell = (body: ReactNode) => (
    <AppShell edges={[]} contentContainerStyle={{ gap: 28 }}>
      {body}
    </AppShell>
  );

  if (isLoading) {
    return shell(<Skeleton className="h-40" />);
  }

  if (!club) {
    return shell(<ManagedClubEmpty />);
  }

  if (isError) {
    // Refetch a échoué : Recrutement reste utilisable avec le club déjà chargé.
  }

  return shell(
    <>
      {isError ? <ErrorState message="Impossible de charger ce club." onRetry={refetch} /> : null}
      <View>
        <Text className="font-display text-display text-fg" style={{ lineHeight: cpcTokens.font.lineHeight.display }}>
          Recrutement
        </Text>
        <Text
          className="mt-1 font-sans text-eyebrow uppercase text-fg-subtle"
          style={{ letterSpacing: cpcTokens.font.letterSpacing.eyebrow }}
        >
          Accepte, refuse ou invite.
        </Text>
      </View>
      <ApplicationsPanel clubId={club.id} />
      <InviteToClubPanel clubId={club.id} members={club.members ?? []} />
      <ClubInvitationsPanel clubId={club.id} />
    </>
  );
}

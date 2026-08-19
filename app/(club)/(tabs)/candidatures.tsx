import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { ApplicationsPanel } from "@/components/club/ApplicationsPanel";
import { ClubInvitationsPanel } from "@/components/club/ClubInvitationsPanel";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";

/**
 * Candidatures — Mode Club (Foundation #1). ApplicationsPanel réutilisé tel
 * quel. Foundation #2.3 — `ModeSwitch` ajouté (voir effectif.tsx : retour
 * Mode Joueur atteignable depuis n'importe quel tab Mode Club).
 *
 * Deux blocs distincts (audit "invitations sortantes introuvables") :
 * candidatures REÇUES (joueur -> club, ApplicationsPanel, inchangé) et
 * invitations CLUB ENVOYÉES (club -> joueur, ClubInvitationsPanel, filtré
 * `slot_id === null` — jamais les invitations MATCH, gérées séparément par
 * app/(club)/(tabs)/match.tsx > PendingInvitations) — même source de données
 * que le raccourci Match Day (`useClubInvitations`, lib/hooks/useInvitations.ts)
 * mais ici jamais repliée par l'état Match Day : c'est la surface de
 * référence pour retrouver l'historique complet (PENDING/ACCEPTED/DECLINED/
 * CANCELLED) après un match.
 */
export default function CandidaturesTab() {
  const { session } = useAuth();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];

  if (isLoading || !club) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {isError ? <ErrorState message="Impossible de charger ce club." onRetry={refetch} /> : <Skeleton className="h-40" />}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
        <ModeSwitch managedClubs={managedClubs} />
        <Text className="font-display text-2xl text-fg">Candidatures</Text>
        <ApplicationsPanel clubId={club.id} />
        <ClubInvitationsPanel clubId={club.id} />
      </ScrollView>
    </SafeAreaView>
  );
}

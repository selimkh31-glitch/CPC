import { type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { ApplicationsPanel } from "@/components/club/ApplicationsPanel";
import { ClubInvitationsPanel } from "@/components/club/ClubInvitationsPanel";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useUnreadNotificationCount } from "@/lib/hooks/useNotifications";

/**
 * Recrutement — candidatures reçues (ApplicationsPanel) + invitations club
 * envoyées (ClubInvitationsPanel). Ancien onglet Candidatures, relabelé.
 * La feuille de match n'est plus un tab (`href: null` sur match.tsx).
 */
export default function RecrutementTab() {
  const { session } = useAuth();
  const { setMode } = useAppMode();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
  const unreadNotifications = useUnreadNotificationCount(session?.user.id ?? null);

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
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
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-2xl text-fg">Recrutement</Text>
        <Pressable
          onPress={() => router.push("/notifications")}
          className="flex-row items-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 py-2 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Bell size={16} color="#f4f5f7" />
          <Text className="text-sm font-bold text-fg">
            Notifs{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
          </Text>
        </Pressable>
      </View>
      <ApplicationsPanel clubId={club.id} />
      <ClubInvitationsPanel clubId={club.id} />
    </>
  );
}

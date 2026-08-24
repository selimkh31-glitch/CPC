import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { LiveSessionPanel } from "@/components/club/LiveSessionPanel";
import { LivePlayersRecruitPanel } from "@/components/club/LivePlayersRecruitPanel";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { findActiveLiveSession } from "@/lib/live";

/**
 * LIVE Mode Club — accueil. Session LIVE du club géré + joueurs LIVE à inviter.
 * La feuille de match (organisation) n'est plus cet écran : push vers /match.
 */
export default function ClubLiveTab() {
  const { session } = useAuth();
  const now = useLiveClock();
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

  const activeSession = findActiveLiveSession(club.sessions, now);
  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const canManage = myMembership?.role === "OWNER" || myMembership?.role === "MANAGER";
  const owner = club.members?.find((m) => m.user_id === club.owner_id);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <ModeSwitch managedClubs={managedClubs} />

        <View>
          <Text className="font-display text-2xl text-fg">Tu veux recruter maintenant ?</Text>
          <Text className="mt-0.5 font-display text-lg text-fg">{club.name}</Text>
          <Text className="text-xs text-fg-muted">Recrutement roster EA SPORTS FC 27 Pro Clubs.</Text>
        </View>

        <LiveSessionPanel
          clubId={club.id}
          activeSession={
            activeSession
              ? {
                  id: activeSession.id,
                  needed_positions: activeSession.needed_positions,
                  note: activeSession.note,
                  expires_at: activeSession.expires_at,
                }
              : null
          }
        />

        {canManage && (
          <LivePlayersRecruitPanel
            clubId={club.id}
            members={club.members ?? []}
            neededPositions={activeSession?.needed_positions ?? []}
            platform={owner?.user?.platform ?? null}
            clubLive={activeSession}
          />
        )}

        <Pressable onPress={() => router.push("/match")} className="active:opacity-80">
          <Text className="text-center text-sm text-accent">Feuille de match</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

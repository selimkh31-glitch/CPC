import { useCallback } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { ClubHome } from "@/components/club/ClubHome";
import { FindClubPanel } from "@/components/club/FindClubPanel";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useMyDepartureUpdates } from "@/lib/hooks/useDepartures";
import { useAuth } from "@/lib/providers/AuthProvider";

/**
 * Ancien onglet Clubs — retiré de la tab bar (`href: null`).
 * Conservé pour deep links `/clubs` : ClubHome si membre, sinon FindClubPanel
 * (même contenu que le volet « Trouver un club » de LIVE).
 */
export default function ClubsScreen() {
  const { session } = useAuth();
  const { data: memberships, isLoading: membershipsLoading } = useMyMemberships(session?.user.id ?? null);

  const onDepartureChange = useCallback(() => {}, []);
  useMyDepartureUpdates(session?.user.id ?? null, onDepartureChange);

  const playerMembership = memberships?.find((m) => m.role === "MEMBER" || m.role === "MANAGER") ?? null;

  if (membershipsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton className="h-40" />
        </View>
      </SafeAreaView>
    );
  }

  if (playerMembership) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ClubHome clubId={playerMembership.club.id} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <FindClubPanel />
    </SafeAreaView>
  );
}

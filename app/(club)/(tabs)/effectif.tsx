import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { MembersPanel } from "@/components/club/MembersPanel";
import { DeparturesPanel } from "@/components/club/DeparturesPanel";
import { InviteToClubPanel } from "@/components/club/InviteToClubPanel";
import { EditClubForm } from "@/components/club/EditClubForm";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";

/**
 * Club — effectif, réglages, switch de mode. Feuille de match en push `/match`.
 * LivePlayersRecruitPanel a déménagé vers l'accueil LIVE club.
 */
export default function ClubTab() {
  const { session } = useAuth();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
  const [editing, setEditing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (isLoading || !club) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {isError ? <ErrorState message="Impossible de charger ce club." onRetry={refetch} /> : <Skeleton className="h-40" />}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const canManage = myMembership?.role === "OWNER" || myMembership?.role === "MANAGER";

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <ModeSwitch managedClubs={managedClubs} />
        <View className="flex-row items-start justify-between">
          <Text className="font-display text-2xl text-fg">{club.name}</Text>
          {club.owner_id === session?.user.id && !editing && (
            <Text className="text-sm text-fg-muted" onPress={() => setEditing(true)} suppressHighlighting>
              Réglages
            </Text>
          )}
        </View>
        {editing ? (
          <EditClubForm club={club} onDone={() => setEditing(false)} />
        ) : (
          <>
            <Pressable onPress={() => router.push("/match")} className="active:opacity-80">
              <Text className="text-sm font-bold text-accent">Feuille de match</Text>
            </Pressable>
            <DeparturesPanel clubId={club.id} members={club.members ?? []} />
            <MembersPanel
              clubId={club.id}
              isOwner={club.owner_id === session?.user.id}
              canManage={canManage}
              members={club.members ?? []}
            />
            {canManage && <InviteToClubPanel clubId={club.id} members={club.members ?? []} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Crown, LogOut, Plus } from "lucide-react-native";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { MyClubsList } from "@/components/club/MyClubsList";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { SocialShortcuts } from "@/components/social/SocialShortcuts";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { registerForPushNotificationsAsync } from "@/lib/notifications";

/**
 * Onglet Profil — ClubPro Card d'abord, puis switch Joueur/Club et réglages.
 * Candidatures / invitations / notifications : onglet Activité.
 * Trouver un club : onglet LIVE. Messages, groupes, bloqués : raccourcis.
 */
export default function ProfileTabScreen() {
  const { session, profile, signOut } = useAuth();
  const { data: memberships, isLoading: membershipsLoading } = useMyMemberships(session?.user.id ?? null);
  const { setMode, setSelectedManagedClubId } = useAppMode();
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];

  useEffect(() => {
    if (session) registerForPushNotificationsAsync(session.user.id).catch(() => {});
  }, [session]);

  if (!session) return null;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-display text-3xl text-fg">Profil</Text>
          <Pressable
            accessibilityLabel="Déconnexion"
            hitSlop={8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              signOut();
            }}
            className="min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <LogOut size={20} color="#9aa0a8" />
          </Pressable>
        </View>

        {managedClubs.length > 0 && (
          <View className="mb-4">
            <ModeSwitch managedClubs={managedClubs} />
          </View>
        )}

        <View className="mb-6 items-center">
          <ProfileContent userId={session.user.id} isOwn />
        </View>

        {profile?.plan !== "PRO" && (
          <Pressable
            onPress={() => router.push("/pricing")}
            className="mb-6 min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-xl border border-pro/40 bg-pro/10 px-4 active:opacity-80"
          >
            <Crown size={16} color="#ae8bff" />
            <Text className="font-bold text-pro-200">Passer Pro</Text>
          </Pressable>
        )}

        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Réglages</Text>
        <View className="mb-6">
          <SocialShortcuts />
        </View>

        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wide text-fg-muted">Mes clubs</Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/create-club");
            }}
            className="min-h-[44px] flex-row items-center gap-1 px-1"
          >
            <Plus size={14} color="#39ff8a" />
            <Text className="text-sm font-bold text-accent">Créer un club</Text>
          </Pressable>
        </View>

        <MyClubsList
          memberships={memberships}
          isLoading={membershipsLoading}
          onManagedSelect={(clubId) => {
            setSelectedManagedClubId(clubId);
            setMode("CLUB");
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ban, Crown, LogOut, MessageCircle, Plus, Users } from "lucide-react-native";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { MyClubsList } from "@/components/club/MyClubsList";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { registerForPushNotificationsAsync } from "@/lib/notifications";

/**
 * Onglet Profil — identité, switch Joueur/Club, réglages.
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
            hitSlop={10}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              signOut();
            }}
          >
            <LogOut size={20} color="#9aa0a8" />
          </Pressable>
        </View>

        {managedClubs.length > 0 && (
          <View className="mb-4">
            <ModeSwitch managedClubs={managedClubs} />
          </View>
        )}

        {profile?.plan !== "PRO" && (
          <Pressable
            onPress={() => router.push("/pricing")}
            className="mb-6 flex-row items-center justify-center gap-1.5 rounded-xl border border-pro/40 bg-pro/10 py-3 active:opacity-80"
          >
            <Crown size={16} color="#ae8bff" />
            <Text className="font-bold text-pro-200">Passer Pro</Text>
          </Pressable>
        )}

        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Social</Text>
        <View className="mb-2 flex-row gap-2">
          <Pressable
            onPress={() => router.push("/conversations")}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated py-3 active:opacity-80"
          >
            <MessageCircle size={16} color="#f4f5f7" />
            <Text className="font-bold text-fg">Messages</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/groups")}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated py-3 active:opacity-80"
          >
            <Users size={16} color="#f4f5f7" />
            <Text className="font-bold text-fg">Groupes</Text>
          </Pressable>
        </View>
        <View className="mb-6 flex-row gap-2">
          <Pressable
            onPress={() => router.push("/blocked")}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated py-3 active:opacity-80"
          >
            <Ban size={16} color="#f4f5f7" />
            <Text className="font-bold text-fg">Bloqués</Text>
          </Pressable>
        </View>

        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wide text-fg-muted">Mes clubs</Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/create-club");
            }}
            className="flex-row items-center gap-1"
          >
            <Plus size={14} color="#39ff8a" />
            <Text className="text-sm font-bold text-accent">Créer un club</Text>
          </Pressable>
        </View>

        <View className="mb-6">
          <MyClubsList
            memberships={memberships}
            isLoading={membershipsLoading}
            onManagedSelect={(clubId) => {
              setSelectedManagedClubId(clubId);
              setMode("CLUB");
            }}
          />
        </View>

        <ProfileContent userId={session.user.id} isOwn />
      </ScrollView>
    </SafeAreaView>
  );
}

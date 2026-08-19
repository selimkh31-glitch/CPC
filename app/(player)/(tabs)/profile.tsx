import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Crown, Inbox, LogOut, Mail, Plus, Search } from "lucide-react-native";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { MyClubsList } from "@/components/club/MyClubsList";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useMyInvitations } from "@/lib/hooks/useInvitations";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { registerForPushNotificationsAsync } from "@/lib/notifications";

/**
 * Onglet Profil (Foundation #1, déplacé depuis app/(tabs)/profile.tsx) —
 * "MON ESPACE" : identité joueur (candidatures, invitations, recherche de
 * club) toujours visible. "Mes clubs" reste ici en RACCOURCI SECONDAIRE.
 *
 * Changement Foundation #1 : une ligne OWNER/MANAGER dans "Mes clubs" ne
 * pousse plus vers /dashboard — elle bascule directement en Mode Club sur ce
 * club (onManagedSelect, sans navigation impérative). Une ligne MEMBER
 * continue de pousser vers /match-sheet (Mode Joueur, inchangé).
 */
export default function ProfileTabScreen() {
  const { session, profile, signOut } = useAuth();
  const { data: memberships, isLoading: membershipsLoading } = useMyMemberships(session?.user.id ?? null);
  const { data: invitations } = useMyInvitations(session?.user.id ?? null);
  const { setMode, setSelectedManagedClubId } = useAppMode();
  const pendingInvitationsCount = invitations?.filter((i) => i.status === "PENDING").length ?? 0;

  useEffect(() => {
    if (session) registerForPushNotificationsAsync(session.user.id).catch(() => {});
  }, [session]);

  if (!session) return null;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-display text-3xl text-fg">Mon espace</Text>
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

        {/* 👤 Profil joueur — ces actions ne dépendent jamais d'un rôle club. */}
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">👤 Profil joueur</Text>

        <View className="mb-2 flex-row gap-2">
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/find-club");
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated py-3 active:opacity-80"
          >
            <Search size={16} color="#f4f5f7" />
            <Text className="font-bold text-fg">Trouver un club</Text>
          </Pressable>
          {profile?.plan !== "PRO" && (
            <Pressable
              onPress={() => router.push("/pricing")}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-pro/40 bg-pro/10 py-3 active:opacity-80"
            >
              <Crown size={16} color="#ae8bff" />
              <Text className="font-bold text-pro-200">Passer Pro</Text>
            </Pressable>
          )}
        </View>

        <View className="mb-6 flex-row gap-2">
          <Pressable
            onPress={() => router.push("/my-applications")}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated py-3 active:opacity-80"
          >
            <Inbox size={16} color="#f4f5f7" />
            <Text className="font-bold text-fg">Mes candidatures</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/my-invitations")}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated py-3 active:opacity-80"
          >
            <Mail size={16} color="#f4f5f7" />
            <Text className="font-bold text-fg">
              Mes invitations{pendingInvitationsCount > 0 ? ` (${pendingInvitationsCount})` : ""}
            </Text>
          </Pressable>
        </View>

        {/* 🏟️ Mes clubs — un même compte peut être OWNER d'un club et MANAGER
            (ou simple MEMBER) d'un autre ; le rôle est toujours par club. */}
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wide text-fg-muted">🏟️ Mes clubs (raccourci)</Text>
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

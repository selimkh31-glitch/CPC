import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Crown, LogOut, Plus } from "lucide-react-native";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { MyClubsList } from "@/components/club/MyClubsList";
import { ModeLifeToggle } from "@/components/club/ModeLifeToggle";
import { DevTestAccountSwitcher } from "@/components/profile/DevTestAccountSwitcher";
import { SocialShortcuts } from "@/components/social/SocialShortcuts";
import { CompetitionsLink } from "@/components/competitions/CompetitionsLink";
import { TournamentsLink } from "@/components/tournaments/TournamentsLink";
import { LeaguesLink } from "@/components/leagues/LeaguesLink";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { FEATURE_REVENUECAT, profileProEntryCopy } from "@/lib/constants";

/**
 * Onglet Profil — Card d'abord, puis la seule bascule « Passer en manager ».
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

  const proEntry = profileProEntryCopy(FEATURE_REVENUECAT);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={[]}>
      <ScrollView contentContainerStyle={{ padding: cpcTokens.geometry.contentPadding, paddingBottom: 32 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-display text-displaySmall text-fg">Profil</Text>
          <Pressable
            accessibilityLabel="Déconnexion"
            hitSlop={8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              signOut();
            }}
            className="min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <LogOut size={cpcTokens.icon.md} color={cpcHex.textMuted} />
          </Pressable>
        </View>

        <View className="mb-8 items-center">
          <ProfileContent userId={session.user.id} isOwn />
        </View>

        <View className="mb-8">
          <ModeLifeToggle target="CLUB" managedClubs={managedClubs} />
        </View>

        <DevTestAccountSwitcher />

        {profile?.plan !== "PRO" && (
          <Pressable
            accessibilityLabel={proEntry.accessibilityLabel}
            onPress={() => router.push("/pricing")}
            className={
              proEntry.looksLikeStore
                ? "mb-8 min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-xl border border-pro/40 bg-pro/10 px-4 active:opacity-80"
                : "mb-8 min-h-[44px] flex-row items-center self-start gap-2 py-1 active:opacity-80"
            }
          >
            <Crown size={16} color={proEntry.looksLikeStore ? "#ae8bff" : cpcHex.textMuted} />
            <View className="items-start">
              <Text className={proEntry.looksLikeStore ? "font-bold text-pro-200" : "text-sm text-fg-subtle"}>
                {proEntry.title}
              </Text>
              {proEntry.subtitle ? (
                <Text className="text-xs text-fg-subtle">{proEntry.subtitle}</Text>
              ) : null}
            </View>
          </Pressable>
        )}

        <SectionHeader title="Réglages" className="mb-2" />
        <View className="mb-6">
          <SocialShortcuts />
          <View className="mt-2">
            <CompetitionsLink />
          </View>
          <View className="mt-2">
            <TournamentsLink />
          </View>
          <View className="mt-2">
            <LeaguesLink />
          </View>
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
            <Plus size={14} color={cpcHex.accent} />
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

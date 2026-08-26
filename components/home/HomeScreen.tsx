import { InteractionManager, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { ClubProCard } from "@/components/profile/ClubProCard";
import { ClubCard } from "@/components/club/ClubCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { buildClubCardData } from "@/lib/clubCard";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useCurrentClubForUser } from "@/lib/hooks/useCurrentClubs";
import { usePlayerMatchHistory } from "@/lib/hooks/useMatchHistory";
import { useMyInvitations } from "@/lib/hooks/useInvitations";
import { useApplications, useMyApplications } from "@/lib/hooks/useApplications";
import { useClub } from "@/lib/hooks/useClubs";
import { useOpenMonClub } from "@/lib/hooks/useOpenMonClub";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { findActiveLiveSession } from "@/lib/live";
import {
  CLUB_MATCHMAKING_HREF,
  CLUB_RECRUTEMENT_HREF,
  PLAYER_MATCHMAKING_HREF,
} from "@/lib/monClubNav";
import { tournamentClubDisplayName } from "@/lib/tournaments";

const INBOX_CAP = 3;

/**
 * Accueil — pièces existantes : ClubPro Card, Mon club, À traiter, CTA Matchmaking.
 * Pas de feed, pas de LIVE, pas de Recrutement sur cet écran.
 */
export function HomeScreen() {
  const { session, profile } = useAuth();
  const { mode, setMode, selectedManagedClubId } = useAppMode();
  const userId = session?.user.id ?? null;
  const now = useLiveClock();
  const { openMonClub, isLoading: membershipsLoading, anyClub, managed } = useOpenMonClub();
  const currentClub = useCurrentClubForUser(userId);
  const { data: matchHistory } = usePlayerMatchHistory(userId);
  const { data: invitations } = useMyInvitations(userId);
  const { data: myApplications } = useMyApplications(userId);
  const managedClubId = selectedManagedClubId ?? managed[0]?.club.id ?? null;
  const homeClubId = selectedManagedClubId ?? anyClub?.club.id ?? null;
  const { data: incoming } = useApplications(managedClubId);
  const { data: clubDetail } = useClub(homeClubId);

  const goProfile = () => {
    if (mode === "CLUB") {
      setMode("PLAYER");
      InteractionManager.runAfterInteractions(() => router.push("/profile"));
      return;
    }
    router.push("/profile");
  };

  const goMatchmaking = () => {
    Haptics.selectionAsync();
    const href = (mode === "CLUB" ? CLUB_MATCHMAKING_HREF : PLAYER_MATCHMAKING_HREF) as Href;
    router.push(href);
  };

  const goRecrutement = () => {
    Haptics.selectionAsync();
    const push = () => router.push(CLUB_RECRUTEMENT_HREF as Href);
    if (mode !== "CLUB") {
      setMode("CLUB");
      InteractionManager.runAfterInteractions(push);
      return;
    }
    push();
  };

  const pendingInvites = (invitations ?? []).filter((inv) => inv.status === "PENDING");
  const pendingSent = (myApplications ?? []).filter((app) => app.status === "PENDING");
  const incomingCount = (incoming ?? []).filter((app) => app.status === "PENDING").length;
  const liveSession = findActiveLiveSession(clubDetail?.sessions, now);
  const liveClubName = liveSession ? (clubDetail?.name?.trim() || anyClub?.club.name?.trim()) : null;

  const inbox: { key: string; label: string; hint?: string; onPress: () => void }[] = [];
  for (const inv of pendingInvites) {
    if (inbox.length >= INBOX_CAP) break;
    const name = tournamentClubDisplayName(inv.club?.name) ?? "Un club";
    inbox.push({
      key: `inv-${inv.id}`,
      label: `${name} t'invite`,
      hint: "Invitation en attente",
      onPress: () => router.push("/my-invitations"),
    });
  }
  for (const app of pendingSent) {
    if (inbox.length >= INBOX_CAP) break;
    const name = tournamentClubDisplayName(app.club?.name) ?? "un club";
    inbox.push({
      key: `app-${app.id}`,
      label: `Candidature chez ${name}`,
      hint: "En attente",
      onPress: () => router.push("/my-applications"),
    });
  }
  if (inbox.length < INBOX_CAP && managedClubId && incomingCount > 0) {
    inbox.push({
      key: "incoming",
      label: incomingCount === 1 ? "1 candidature à traiter" : `${incomingCount} candidatures à traiter`,
      hint: "Recrutement",
      onPress: goRecrutement,
    });
  }
  if (inbox.length < INBOX_CAP && liveClubName) {
    inbox.push({
      key: "live",
      label: `${liveClubName} est en ligne`,
      hint: "Matchmaking",
      onPress: goMatchmaking,
    });
  }

  const club = anyClub?.club ?? null;
  const clubCard = club?.name?.trim()
    ? buildClubCardData({ id: club.id, name: club.name.trim(), level: club.level ?? undefined })
    : null;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={[]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="font-display text-[34px] leading-10 text-fg">Accueil</Text>

        <View className="items-center">
          <ClubProCard
            user={profile}
            clubName={currentClub.data?.name ?? null}
            clubId={currentClub.data?.id ?? null}
            cpcMatchesPlayed={matchHistory?.played ?? null}
            onPress={goProfile}
          />
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-fg-muted">Mon club</Text>
          {membershipsLoading ? (
            <Skeleton className="h-14" />
          ) : clubCard ? (
            <ClubCard data={clubCard} variant="mini" onPress={openMonClub} />
          ) : (
            <View className="gap-3 rounded-2xl border border-dashed border-white/[0.08] px-4 py-4">
              <Text className="text-[14px] text-fg-muted">Tu n&apos;as pas de club.</Text>
              <Button className="min-h-[48px]" onPress={() => router.push("/create-club")}>
                Créer un club
              </Button>
              <Button variant="ghost" className="min-h-[44px]" onPress={() => router.push("/find-club")}>
                Trouver un club
              </Button>
            </View>
          )}
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-fg-muted">À traiter</Text>
          {inbox.length === 0 ? (
            <Text className="text-[14px] text-fg-subtle">Rien à traiter.</Text>
          ) : (
            <View className="gap-2">
              {inbox.map((row) => (
                <Pressable
                  key={row.key}
                  onPress={row.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  className="min-h-[44px] justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 active:opacity-80"
                >
                  <Text className="text-[14px] font-medium text-fg">{row.label}</Text>
                  {row.hint ? <Text className="mt-0.5 text-[12px] text-fg-subtle">{row.hint}</Text> : null}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Button size="lg" className="min-h-[52px]" onPress={goMatchmaking}>
          Matchmaking
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

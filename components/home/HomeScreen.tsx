import { Text, View } from "react-native";
import { router, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { ClubProCard } from "@/components/profile/ClubProCard";
import { ClubCard } from "@/components/club/ClubCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { AppShell } from "@/components/nav/AppShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { buildClubCardData, buildClubCardDataFromHydratedClub } from "@/lib/clubCard";
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
  const { mode, selectedManagedClubId } = useAppMode();
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
      router.push("/effectif");
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
    if (mode !== "CLUB") return;
    Haptics.selectionAsync();
    router.push(CLUB_RECRUTEMENT_HREF as Href);
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
  if (mode === "CLUB" && inbox.length < INBOX_CAP && managedClubId && incomingCount > 0) {
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
    ? clubDetail && clubDetail.id === club.id
      ? buildClubCardDataFromHydratedClub(clubDetail, {
          members: clubDetail.members,
          sessions: clubDetail.sessions,
          nowMs: now,
        })
      : buildClubCardData({ id: club.id, name: club.name.trim(), level: club.level ?? undefined })
    : null;

  return (
    <AppShell edges={[]} contentContainerStyle={{ gap: 28 }}>
      <Text className="font-display text-display text-fg" style={{ lineHeight: cpcTokens.font.lineHeight.display }}>
        Accueil
      </Text>

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
        <SectionHeader title="Mon club" />
        {membershipsLoading ? (
          <Skeleton className="h-14" />
        ) : clubCard ? (
          <ClubCard data={clubCard} variant="compact" onPress={openMonClub} />
        ) : mode === "CLUB" ? (
          <View className="gap-3 border border-dashed border-border px-4 py-4">
            <Text className="text-body text-fg-muted">Aucun club géré.</Text>
            <Button className="min-h-[44px]" onPress={() => router.push("/create-club")}>
              Créer un club
            </Button>
          </View>
        ) : (
          <View className="gap-3 border border-dashed border-border px-4 py-4">
            <Text className="text-body text-fg-muted">Sans club.</Text>
            <Text className="font-sans text-caption text-fg-subtle">Trouve un club LIVE sur Matchmaking.</Text>
            <Button variant="secondary" className="min-h-[44px]" onPress={goMatchmaking}>
              Matchmaking
            </Button>
          </View>
        )}
      </View>

      <View className="gap-2">
        <SectionHeader title="À traiter" />
        {inbox.length === 0 ? (
          <Text className="text-body text-fg-subtle">Rien à traiter.</Text>
        ) : (
          <View className="gap-2">
            {inbox.map((row) => (
              <ActivityRow key={row.key} title={row.label} subtitle={row.hint} onPress={row.onPress} />
            ))}
          </View>
        )}
      </View>

      <Button size="lg" className="min-h-[52px]" onPress={goMatchmaking}>
        Matchmaking
      </Button>
    </AppShell>
  );
}

import { useCallback, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ManagedClubEmpty } from "@/components/club/ManagedClubEmpty";
import { ClubDiscoveryToggle } from "@/components/club/ClubDiscoveryToggle";
import { ClubRosterList } from "@/components/club/ClubRosterList";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { cpcHex } from "@/lib/design/cpc-native";
import { CLUB_MATCH_SHEET_HREF, LIVE_UX_COPY } from "@/lib/live";
import {
  canMutateClub,
  clubSessionSnapshot,
  formatNeededPositionsLine,
  neededPositionsFromEmptySlots,
} from "@/lib/sessionState";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useActiveMatchCheckin } from "@/lib/hooks/useMatchCheckin";
import { useAuth } from "@/lib/providers/AuthProvider";
import type { FormationId } from "@/lib/formations";

/**
 * Matchmaking Mode Club — recrutement LIVE (visibilité + postes cherchés).
 * Distinct de l'onglet Match (feuille / pitch).
 */
export function ClubLiveRecruit() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: activeCheckin } = useActiveMatchCheckin(club?.id ?? null);

  useFocusEffect(
    useCallback(() => {
      if (!club) return;
      refetch();
    }, [club, refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={[]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: cpcTokens.geometry.contentPadding, paddingTop: 8, paddingBottom: 36, gap: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (isLoading) {
    return shell(<Skeleton className="h-[220px]" />);
  }

  if (!club) {
    return shell(<ManagedClubEmpty />);
  }

  if (isError) {
    // Refetch focus a échoué : on garde le recrutement, pas un overlay qui coupe le LIVE.
  }

  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const canManage = canMutateClub(myMembership?.role);
  const snapshot = clubSessionSnapshot(club.sessions, activeCheckin ?? null, now);
  const liveSession = snapshot.live.active
    ? {
        id: snapshot.live.sessionId,
        needed_positions: snapshot.live.neededPositions,
        note: snapshot.live.note,
        expires_at: snapshot.live.expiresAt,
        is_live: true as const,
      }
    : null;
  const formationId = (club.formation as FormationId | null) ?? null;
  const assignments = club.slotAssignments ?? [];
  const vacancies = neededPositionsFromEmptySlots(formationId, assignments);
  const neededLine = liveSession ? formatNeededPositionsLine(liveSession.needed_positions) : formatNeededPositionsLine(vacancies);

  return shell(
    <>
      {isError ? <ErrorState message="Impossible de charger ce club." onRetry={refetch} /> : null}

      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text
            className="font-display text-display text-fg"
            style={{ lineHeight: cpcTokens.font.lineHeight.display, color: cpcHex.textPrimary }}
            numberOfLines={2}
          >
            {club.name}
          </Text>
          <Text className="mt-1 font-sans text-body text-fg-muted" style={{ color: cpcHex.textMuted }}>
            {LIVE_UX_COPY.clubHeadline}
          </Text>
        </View>
        {liveSession ? <LiveBadge /> : null}
      </View>

      <ClubDiscoveryToggle
        clubId={club.id}
        activeSession={liveSession}
        neededPositions={vacancies}
        canManage={canManage}
        pitchReady={Boolean(formationId)}
      />

      <View className="gap-2">
        <SectionHeader title="On cherche" />
        {neededLine ? (
          <Text className="font-sans text-body text-fg" style={{ color: cpcHex.textPrimary }}>
            Cherche {neededLine}
          </Text>
        ) : (
          <Text className="font-sans text-body text-fg-muted" style={{ color: cpcHex.textMuted }}>
            {formationId
              ? "Feuille complète — plus de poste vacant."
              : "Choisis une formation sur l'onglet Match pour publier des postes."}
          </Text>
        )}
        {liveSession?.note ? (
          <Text className="font-sans text-caption text-fg-subtle" style={{ color: cpcHex.disabled }}>
            {liveSession.note}
          </Text>
        ) : null}
      </View>

      <ClubRosterList members={club.members} currentUserId={session?.user.id ?? null} clubId={club.id} />

      <Pressable
        onPress={() => router.push(CLUB_MATCH_SHEET_HREF)}
        className="min-h-[44px] items-center justify-center border border-border bg-bg-elevated active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel="Voir la feuille de match"
      >
        <Text className="font-sans-semibold text-body text-fg" style={{ color: cpcHex.textPrimary }}>
          Voir la feuille
        </Text>
      </Pressable>
    </>
  );
}

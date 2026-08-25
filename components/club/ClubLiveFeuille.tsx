import { useCallback, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Mail } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { ManagedClubEmpty } from "@/components/club/ManagedClubEmpty";
import { PlayerCard } from "@/components/player/PlayerCard";
import { FormationPitch } from "@/components/club/FormationPitch";
import { FormationSelector } from "@/components/club/FormationSelector";
import { MatchCheckinPanel } from "@/components/club/MatchCheckinPanel";
import { VoiceLinkBlock } from "@/components/club/VoiceLinkBlock";
import { ClubDiscoveryToggle } from "@/components/club/ClubDiscoveryToggle";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { FORMATIONS, type FormationId, type FormationSlot } from "@/lib/formations";
import {
  canMutateClub,
  clubSessionSnapshot,
  filledSlotCount,
  neededPositionsFromEmptySlots,
  rosterFillLabel,
} from "@/lib/sessionState";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useClubInvitations } from "@/lib/hooks/useInvitations";
import { useActiveMatchCheckin } from "@/lib/hooks/useMatchCheckin";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { FINALIZE_MATCH_COPY } from "@/lib/finalizeMatch";
import { buildPlayerCardData } from "@/lib/playerCard";

/**
 * Feuille manager (onglet LIVE et deep link `/match`).
 * Chrome : nom du club + un ON/OFF de découverte. Le terrain reste visible.
 * Check-in plus bas. Pas de carte intern de statut.
 */
export function ClubLiveFeuille() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { setSelectedManagedClubId } = useAppMode();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
  const { data: activeCheckin } = useActiveMatchCheckin(club?.id ?? null);

  useFocusEffect(
    useCallback(() => {
      if (!club) return;
      refetch();
    }, [club, refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* iOS: padding, offset 0 — contenu déjà sous le notch, au-dessus de la tab bar (pas un header stack). */}
      {/* Android: undefined — windowSoftInputMode resize (app.json) rétrécit la fenêtre ; padding doublerait. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (isLoading) {
    return shell(<Skeleton className="h-[420px]" />);
  }

  if (!club) {
    return shell(<ManagedClubEmpty />);
  }

  if (isError) {
    // Refetch focus a échoué : on garde la feuille, pas un overlay qui coupe le LIVE.
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
  const members = club.members ?? [];
  const fill = rosterFillLabel(filledSlotCount(assignments));
  const vacancies = neededPositionsFromEmptySlots(formationId, assignments);

  const onEmptySlotPress = (slot: FormationSlot) => {
    if (!canManage) return;
    router.push(`/player-search?clubId=${club.id}&slotId=${slot.slotId}&position=${slot.position}`);
  };

  return shell(
    <>
      {isError ? <ErrorState message="Impossible de charger ce club." onRetry={refetch} /> : null}
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-display text-2xl text-fg">{club.name}</Text>
          <Text className="mt-0.5 text-sm text-fg-muted">EA SPORTS FC 27 Pro Clubs</Text>
        </View>
      </View>

      <ClubDiscoveryToggle
        clubId={club.id}
        activeSession={liveSession}
        neededPositions={vacancies}
        canManage={canManage}
        pitchReady={Boolean(formationId)}
      />

      <View className="flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="font-display text-lg text-fg">Effectif</Text>
          <Text className="text-sm text-fg-muted">{fill}</Text>
        </View>
        {canManage ? (
          <FormationSelector clubId={club.id} currentFormation={formationId} hasAssignments={assignments.length > 0} />
        ) : formationId ? (
          <Text className="font-display text-base text-fg-muted">{formationId}</Text>
        ) : null}
      </View>

      {members.length === 0 ? (
        <EmptyState title="Aucun membre dans ce club." subtitle="L'effectif vient de club_members — rien n'est inventé." />
      ) : !formationId ? (
        <EmptyState title="Choisis une formation pour composer ton équipe." />
      ) : (
        <FormationPitch
          formationId={formationId}
          assignments={assignments}
          interactive={canManage}
          clubId={club.id}
          onEmptySlotPress={canManage ? onEmptySlotPress : undefined}
          emptySlotHint="Inviter sur ce poste"
        />
      )}

      <VoiceLinkBlock voiceLink={club.voice_link} />

      <PendingInvitations clubId={club.id} formationId={formationId} />

      {formationId && canManage ? (
        <MatchCheckinPanel
          clubId={club.id}
          sessionId={liveSession?.id ?? null}
          formationId={formationId}
          assignments={assignments}
          members={members}
        />
      ) : null}

      {managedClubs.length > 1 && (
        <Pressable
          onPress={() => setSelectedManagedClubId(null)}
          className="min-h-[44px] items-center justify-center active:opacity-80"
        >
          <Text className="text-center text-sm text-accent">Changer de club — tu en gères {managedClubs.length}</Text>
        </Pressable>
      )}
    </>
  );
}

function PendingInvitations({ clubId, formationId }: { clubId: string; formationId: FormationId | null }) {
  const { data: allInvitations, isLoading, isError, error, refetch } = useClubInvitations(clubId);
  const invitations = allInvitations?.filter((inv) => inv.status === "PENDING" && inv.slot_id !== null);
  const positionBySlotId = formationId
    ? new Map<string, PositionCode>(FORMATIONS[formationId].map((s) => [s.slotId, s.position]))
    : new Map<string, PositionCode>();

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Mail size={18} color="#f4f5f7" />}>Invitations en attente</CardTitle>
        <Text className="text-sm text-fg-muted">{invitations?.length ?? 0}</Text>
      </CardHeader>
      {isLoading ? (
        <Skeleton className="h-16" />
      ) : isError ? (
        <ErrorState
          message={__DEV__ && error instanceof Error ? error.message : "Impossible de charger les invitations."}
          onRetry={refetch}
        />
      ) : !invitations || invitations.length === 0 ? (
        <Text className="text-sm text-fg-muted">Aucune invitation en attente.</Text>
      ) : (
        <View className="gap-2">
          <Text className="text-xs text-fg-subtle">{FINALIZE_MATCH_COPY.invitationsHint}</Text>
          {invitations.map((inv) => {
            const position = inv.slot_id ? positionBySlotId.get(inv.slot_id) : null;
            const statusBadge = <Badge tone="warn">En attente</Badge>;
            const footer = (
              <Text className="mt-1 text-xs text-fg-subtle">
                {position ? POSITION_LABELS[position] : "Poste à définir"}
              </Text>
            );
            if (!inv.user) {
              return (
                <View key={inv.id} className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-border bg-bg-elevated p-2.5">
                  <View className="min-w-0 flex-1">
                    <Text className="font-semibold text-fg-muted">Joueur</Text>
                    {footer}
                  </View>
                  {statusBadge}
                </View>
              );
            }
            return (
              <PlayerCard
                key={inv.id}
                data={buildPlayerCardData(inv.user, { needPositions: position })}
                variant="mini"
                rightSlot={statusBadge}
                footer={footer}
              />
            );
          })}
        </View>
      )}
    </Card>
  );
}

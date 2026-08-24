import { useCallback, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { ChevronDown, ChevronUp, Mail, Users } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { FormationPitch } from "@/components/club/FormationPitch";
import { FormationSelector } from "@/components/club/FormationSelector";
import { MatchCheckinPanel } from "@/components/club/MatchCheckinPanel";
import { LiveSessionPanel } from "@/components/club/LiveSessionPanel";
import { VoiceLinkBlock } from "@/components/club/VoiceLinkBlock";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { ClubSessionStatus } from "@/components/club/ClubSessionStatus";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { FORMATIONS, type FormationId, type FormationSlot } from "@/lib/formations";
import {
  benchMembers,
  canMutateClub,
  clubSessionSnapshot,
  filledSlotCount,
  rosterFillLabel,
} from "@/lib/sessionState";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useClubInvitations } from "@/lib/hooks/useInvitations";
import { useActiveMatchCheckin } from "@/lib/hooks/useMatchCheckin";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";

/**
 * Feuille de match — organisation (hors tab bar, `href: null`).
 * Accessible en push depuis LIVE club ou l'onglet Club (`/match`).
 * Effectif = club_members + slot_assignments. Invite-to-slot inchangé.
 */
export default function MatchTab() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { setMode, setSelectedManagedClubId } = useAppMode();
  const { data: club, isLoading, isError, refetch, isFetching } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const [isMatchDay, setIsMatchDay] = useState(false);
  const [prepExpanded, setPrepExpanded] = useState(false);

  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
  const {
    data: activeCheckin,
    isLoading: checkinLoading,
    isError: checkinError,
    refetch: refetchCheckin,
  } = useActiveMatchCheckin(club?.id ?? null);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <ModeSwitch managedClubs={managedClubs} />
        {body}
      </ScrollView>
    </SafeAreaView>
  );

  if (isLoading || (isFetching && !club && !isError)) {
    return shell(<Skeleton className="h-[420px]" />);
  }

  if (isError) {
    return shell(<ErrorState message="Impossible de charger la feuille de match." onRetry={refetch} />);
  }

  if (!club) {
    return shell(
      <View className="gap-4">
        <EmptyState
          title="Aucun club géré"
          subtitle="La feuille de match est réservée à l'owner ou un manager d'un club EA SPORTS FC 27 Pro Clubs."
        />
        <Button variant="ghost" onPress={() => setMode("PLAYER")}>
          Retour mode Joueur
        </Button>
      </View>
    );
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
  const bench = benchMembers(members, assignments);
  const fill = rosterFillLabel(filledSlotCount(assignments));

  const onEmptySlotPress = (slot: FormationSlot) => {
    if (!canManage) return;
    router.push(`/player-search?clubId=${club.id}&slotId=${slot.slotId}&position=${slot.position}`);
  };

  const prepVisible = !isMatchDay || prepExpanded;

  return shell(
    <>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-display text-2xl text-fg">{club.name}</Text>
          <Text className="mt-0.5 text-sm text-fg-muted">Feuille de match · EA SPORTS FC 27 Pro Clubs</Text>
        </View>
      </View>

      <ClubSessionStatus
        snapshot={snapshot}
        checkinLoading={checkinLoading}
        checkinError={checkinError}
        onRetryCheckin={() => refetchCheckin()}
      />

      {isMatchDay && formationId && canManage && (
        <MatchCheckinPanel
          key="match-checkin-panel"
          clubId={club.id}
          sessionId={liveSession?.id ?? null}
          formationId={formationId}
          assignments={assignments}
          members={members}
          onLiveChange={setIsMatchDay}
        />
      )}

      {isMatchDay && (
        <Pressable
          onPress={() => setPrepExpanded((v) => !v)}
          accessibilityRole="button"
          className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-border bg-bg-elevated px-3 active:opacity-80"
        >
          <Text className="text-sm font-bold text-fg-muted">Préparation</Text>
          {prepExpanded ? <ChevronUp size={16} color="#9aa0a8" /> : <ChevronDown size={16} color="#9aa0a8" />}
        </Pressable>
      )}

      {prepVisible && (
        <>
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
              onEmptySlotPress={canManage ? onEmptySlotPress : undefined}
              emptySlotHint="Inviter sur ce poste"
            />
          )}

          {bench.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle icon={<Users size={18} color="#f4f5f7" />}>Banc</CardTitle>
                <Text className="text-sm text-fg-muted">{bench.length}</Text>
              </CardHeader>
              <View className="gap-1">
                {bench.map((m) => (
                  <Pressable
                    key={m.user_id}
                    onPress={() => router.push(`/profile/${m.user_id}`)}
                    className="min-h-[44px] justify-center active:opacity-70"
                  >
                    <Text numberOfLines={1} className="text-sm text-fg">
                      {m.user?.username ?? "Joueur"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          )}

          <LiveSessionPanel clubId={club.id} activeSession={liveSession} canManage={canManage} />

          <VoiceLinkBlock voiceLink={club.voice_link} />

          <PendingInvitations clubId={club.id} formationId={formationId} />
        </>
      )}

      {!isMatchDay && formationId && canManage && (
        <MatchCheckinPanel
          key="match-checkin-panel"
          clubId={club.id}
          sessionId={liveSession?.id ?? null}
          formationId={formationId}
          assignments={assignments}
          members={members}
          onLiveChange={setIsMatchDay}
        />
      )}

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
          {invitations.map((inv) => {
            const position = inv.slot_id ? positionBySlotId.get(inv.slot_id) : null;
            return (
              <View key={inv.id} className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-border bg-bg-elevated p-2.5">
                <View>
                  <Text className="font-semibold text-fg">{inv.user?.username ?? "Joueur"}</Text>
                  <Text className="text-xs text-fg-subtle">{position ? POSITION_LABELS[position] : "Poste à définir"}</Text>
                </View>
                <Badge tone="warn">En attente</Badge>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

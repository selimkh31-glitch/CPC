import { useCallback, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Mail } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { cpcHex } from "@/lib/design/cpc-native";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { ManagedClubEmpty } from "@/components/club/ManagedClubEmpty";
import { ClubCard } from "@/components/club/ClubCard";
import { PlayerCard } from "@/components/player/PlayerCard";
import { FormationPitch } from "@/components/club/FormationPitch";
import { FormationSelector } from "@/components/club/FormationSelector";
import { VoiceLinkBlock } from "@/components/club/VoiceLinkBlock";
import { ClubRosterList } from "@/components/club/ClubRosterList";
import { AssignSlotMemberSheet } from "@/components/club/AssignSlotMemberSheet";
import { type PositionCode } from "@/lib/constants";
import { FORMATIONS, type FormationId, type FormationSlot } from "@/lib/formations";
import { canMutateClub, filledSlotCount, rosterFillLabel } from "@/lib/sessionState";
import { buildClubCardDataFromHydratedClub } from "@/lib/clubCard";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useClubInvitations, useCancelInvitation } from "@/lib/hooks/useInvitations";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { FINALIZE_MATCH_COPY } from "@/lib/finalizeMatch";
import { buildPlayerCardData } from "@/lib/playerCard";
import { toast } from "@/lib/toast";

/**
 * Feuille manager (onglet Match et deep link `/match`).
 * Terrain + effectif. Le recrutement LIVE vit sur l'onglet Matchmaking.
 * Pas de check-in ni de coup d'envoi sur cet écran.
 */
export function ClubLiveFeuille() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { setSelectedManagedClubId } = useAppMode();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
  const [slotToFill, setSlotToFill] = useState<FormationSlot | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!club) return;
      refetch();
    }, [club, refetch])
  );

  const shell = (body: ReactNode) => (
    <SafeAreaView className="flex-1 bg-bg" edges={[]}>
      {/* iOS: padding, offset 0 — contenu déjà sous le notch, au-dessus de la tab bar (pas un header stack). */}
      {/* Android: undefined — windowSoftInputMode resize (app.json) rétrécit la fenêtre ; padding doublerait. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: cpcTokens.geometry.contentPadding, paddingTop: 8, paddingBottom: 36, gap: 24 }} keyboardShouldPersistTaps="handled">
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
  const formationId = (club.formation as FormationId | null) ?? null;
  const assignments = club.slotAssignments ?? [];
  const members = club.members ?? [];
  const fill = rosterFillLabel(filledSlotCount(assignments));

  const onEmptySlotPress = (slot: FormationSlot) => {
    if (!canManage) return;
    setSlotToFill(slot);
  };

  return shell(
    <>
      {isError ? <ErrorState message="Impossible de charger ce club." onRetry={refetch} /> : null}

      <View className="gap-2">
        <Text
          className="font-sans text-eyebrow uppercase text-fg-subtle"
          style={{ letterSpacing: cpcTokens.font.letterSpacing.eyebrow, color: cpcHex.disabled }}
        >
          Feuille de match
        </Text>
        <ClubCard
          data={buildClubCardDataFromHydratedClub(club, {
            members: club.members,
            sessions: club.sessions,
            nowMs: now,
          })}
          variant="full"
          interactive={false}
        />
      </View>

      <ClubRosterList members={members} currentUserId={session?.user.id ?? null} clubId={club.id} />

      <View className="flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1">
          <SectionHeader title="Formation" />
          <Text className="text-[12px] text-fg-subtle" style={{ color: cpcHex.disabled }}>
            {fill} — le XI n&apos;est pas l&apos;effectif
          </Text>
        </View>
        {canManage ? (
          <FormationSelector clubId={club.id} currentFormation={formationId} hasAssignments={assignments.length > 0} />
        ) : formationId ? (
          <Text className="font-mono text-[11px] font-bold text-fg-muted">{formationId}</Text>
        ) : null}
      </View>

      {!formationId ? (
        <EmptyState title="Choisis une formation pour composer ton équipe." />
      ) : (
        <FormationPitch
          formationId={formationId}
          assignments={assignments}
          interactive={canManage}
          clubId={club.id}
          currentUserId={session?.user.id ?? null}
          onEmptySlotPress={canManage ? onEmptySlotPress : undefined}
          emptySlotHint="Placer un membre"
        />
      )}

      {canManage ? (
        <AssignSlotMemberSheet
          clubId={club.id}
          slot={slotToFill}
          members={members}
          assignments={assignments}
          onClose={() => setSlotToFill(null)}
        />
      ) : null}

      <VoiceLinkBlock voiceLink={club.voice_link} />

      <PendingInvitations clubId={club.id} formationId={formationId} />

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
  const cancelInvitation = useCancelInvitation(clubId);
  const [actingId, setActingId] = useState<string | null>(null);

  const cancel = (invitationId: string) => {
    if (actingId || cancelInvitation.isPending) return;
    setActingId(invitationId);
    cancelInvitation.mutate(
      { invitationId },
      {
        onSuccess: () => toast.success("Invitation annulée."),
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible d'annuler."),
        onSettled: () => setActingId(null),
      }
    );
  };

  return (
    <Card className="p-3">
      <CardHeader className="mb-2">
        <CardTitle icon={<Mail size={16} color={cpcHex.textMuted} />} className="text-[13px] font-medium normal-case tracking-normal text-fg-muted">
          Invitations en attente
        </CardTitle>
        <Text className="text-[12px] text-fg-subtle">{invitations?.length ?? 0}</Text>
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
              <View className="mt-1 flex-row items-center justify-between gap-2">
                <Text className="font-mono text-[10px] font-bold text-fg-subtle">
                  {position ?? "Poste"}
                </Text>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={actingId === inv.id}
                  disabled={Boolean(actingId)}
                  onPress={() => cancel(inv.id)}
                  className="min-h-[44px] self-end px-2"
                  accessibilityLabel="Annuler l'invitation"
                >
                  Annuler
                </Button>
              </View>
            );
            if (!inv.user) {
              return (
                <View key={inv.id} className="min-h-[44px] flex-row items-center justify-between border border-border bg-bg-elevated px-2.5 py-2">
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

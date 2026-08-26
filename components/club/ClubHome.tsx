import { Alert, ScrollView, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { PulseDot } from "@/components/ui/PulseDot";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { ClubCard } from "@/components/club/ClubCard";
import { FormationPitch } from "@/components/club/FormationPitch";
import { JoinLiveClubButton } from "@/components/club/JoinLiveClubButton";
import { MyDepartureStatusCard } from "@/components/club/MyDepartureStatusCard";
import { VoiceLinkBlock } from "@/components/club/VoiceLinkBlock";
import { useClub } from "@/lib/hooks/useClubs";
import { useClaimSlot } from "@/lib/hooks/useJoinLiveClub";
import { useAuth } from "@/lib/providers/AuthProvider";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { findActiveLiveSession } from "@/lib/live";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { formatNeededPositionsLine } from "@/lib/sessionState";
import { buildClubCardDataFromHydratedClub } from "@/lib/clubCard";
import type { FormationId, FormationSlot } from "@/lib/formations";

/**
 * "Mon Club" — vue joueur d'un club. Un visiteur LIVE rejoint le club
 * (MEMBER) ; un membre tape un slot vide pour prendre le poste, pas pour
 * candidater (`apply`). Le recrutement manager (player-search) vit dans
 * ClubLiveFeuille. Consommé par :
 *   - app/(player)/(tabs)/clubs.tsx si playerMembership
 *   - app/match-sheet.tsx (entrées externes)
 */
export function ClubHome({ clubId }: { clubId: string | null }) {
  const { session } = useAuth();
  const now = useLiveClock();
  const { data: club, isLoading, isError, refetch } = useClub(clubId);
  const claim = useClaimSlot(clubId ?? "");

  if (isError) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <ErrorState message="Impossible de charger la feuille de match." onRetry={refetch} />
      </ScrollView>
    );
  }

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Skeleton className="h-[420px]" />
      </ScrollView>
    );
  }

  if (!club) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title="Ce club n'est plus là." subtitle="Il a été retiré, ou tu n'y as plus accès." />
      </ScrollView>
    );
  }

  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const isMember = Boolean(myMembership);
  const formationId = (club.formation as FormationId | null) ?? null;
  const assignments = club.slotAssignments ?? [];
  const activeSession = findActiveLiveSession(club.sessions, now);
  const neededLine = activeSession ? formatNeededPositionsLine(activeSession.needed_positions) : null;
  const managers = (club.members ?? []).filter((m) => m.role === "MANAGER");
  const cardData = buildClubCardDataFromHydratedClub(club, {
    members: club.members,
    sessions: club.sessions,
    nowMs: now,
  });

  const onEmptySlotPress = (slot: FormationSlot) => {
    if (!isMember || !clubId) return;
    if (claim.isPending) return;
    const positionLabel = POSITION_LABELS[slot.position as PositionCode] ?? slot.position;
    Alert.alert(`Prendre le poste ${positionLabel} ?`, undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Prendre",
        onPress: () => {
          claim.mutate(
            { slotId: slot.slotId, position: slot.position },
            {
              onSuccess: () => toast.success("Poste pris."),
              onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible de prendre ce poste."),
            }
          );
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
      <ClubCard data={cardData} variant="full" interactive={false} />
      {managers.length > 0 ? (
        <Text numberOfLines={2} className="text-xs text-fg-subtle">
          Manager : {managers.map((m) => m.user?.username).filter(Boolean).join(", ")}
        </Text>
      ) : null}

      <Card>
        <Text className="mb-2 font-display text-lg text-fg">Recrutement LIVE</Text>
        {activeSession ? (
          <>
            <View className="mb-3 flex-row items-center gap-1.5">
              <PulseDot />
              <Text className="text-xs font-extrabold text-accent">LIVE</Text>
            </View>
            {neededLine ? <Text className="mb-3 text-sm text-fg">Cherche {neededLine}</Text> : null}
            {activeSession.note && <Text className="mb-3 text-sm text-fg-muted">{activeSession.note}</Text>}
            {session && !isMember ? (
              <JoinLiveClubButton clubId={club.id} label="Rejoindre le club" size="md" navigateToSheet={false} />
            ) : null}
          </>
        ) : (
          <Text className="text-xs text-fg-subtle">Hors ligne — aucun recrutement LIVE actif.</Text>
        )}
      </Card>

      <VoiceLinkBlock voiceLink={club.voice_link} />

      <View className="flex-row items-center justify-between">
        <Text className="font-display text-lg text-fg">Formation</Text>
        {formationId && <Text className="font-display text-base text-fg-muted">{formationId}</Text>}
      </View>

      {formationId ? (
        <FormationPitch
          formationId={formationId}
          assignments={assignments}
          onEmptySlotPress={isMember ? onEmptySlotPress : undefined}
          currentUserId={session?.user.id ?? null}
          clubId={club.id}
          interactive={isMember}
          emptySlotHint="Prendre ce poste"
        />
      ) : (
        <EmptyState title="Ce club n'a pas encore configuré sa formation." />
      )}

      {myMembership && myMembership.role !== "OWNER" && session && (
        <MyDepartureStatusCard clubId={club.id} userId={session.user.id} membership={myMembership} />
      )}
    </ScrollView>
  );
}

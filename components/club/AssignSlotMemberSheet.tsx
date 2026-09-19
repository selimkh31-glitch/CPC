import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { ProfileRow } from "@/components/ui/ProfileRow";
import { Sheet } from "@/components/ui/Sheet";
import { cpcHex } from "@/lib/design/cpc-native";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { membersAvailableForSlot } from "@/lib/sessionState";
import { useAssignClubMemberSlot } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";
import type { ClubMemberRow, SlotAssignmentRow } from "@/lib/types";
import type { FormationSlot } from "@/lib/formations";

/**
 * Tap « + » sur un slot vide : placer un membre déjà au club (pas auto-XI),
 * ou ouvrir la recherche LIVE pour inviter un non-membre.
 */
export function AssignSlotMemberSheet({
  clubId,
  slot,
  members,
  assignments,
  onClose,
}: {
  clubId: string;
  slot: FormationSlot | null;
  members: ClubMemberRow[];
  assignments: SlotAssignmentRow[];
  onClose: () => void;
}) {
  const assign = useAssignClubMemberSlot(clubId);
  const [actingId, setActingId] = useState<string | null>(null);
  const available = slot ? membersAvailableForSlot(members, assignments, slot.position) : [];
  const positionLabel = slot ? (POSITION_LABELS[slot.position as PositionCode] ?? slot.position) : "";

  const place = (userId: string) => {
    if (!slot || assign.isPending) return;
    setActingId(userId);
    assign.mutate(
      { slotId: slot.slotId, userId },
      {
        onSuccess: () => {
          toast.success("Joueur placé sur la feuille.");
          onClose();
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Impossible de placer ce joueur.");
        },
        onSettled: () => setActingId(null),
      }
    );
  };

  const inviteFromLive = () => {
    if (!slot) return;
    onClose();
    router.push(`/player-search?clubId=${clubId}&slotId=${slot.slotId}&position=${slot.position}`);
  };

  return (
    <Sheet visible={Boolean(slot)} onClose={onClose} title={slot ? `Placer · ${slot.position}` : "Placer"}>
      <View className="gap-3">
        <Text className="font-sans text-body text-fg-muted" style={{ color: cpcHex.textMuted }}>
          Membres du club pas encore sur le XI{positionLabel ? ` — poste ${positionLabel}` : ""}. L&apos;effectif n&apos;est
          pas la feuille.
        </Text>

        {available.length === 0 ? (
          <Text className="font-sans text-body text-fg" style={{ color: cpcHex.textPrimary }}>
            Tous les membres sont déjà titulaires, ou l&apos;effectif est vide. Invite un joueur depuis le LIVE.
          </Text>
        ) : (
          <View className="gap-1">
            {available.map((m) => {
              const name = m.user?.username?.trim() || "Joueur";
              const main = m.user?.main_position;
              const meta = [main, m.role === "OWNER" ? "Owner" : m.role === "MANAGER" ? "Manager" : "Membre"]
                .filter(Boolean)
                .join(" · ");
              return (
                <View key={m.id ?? m.user_id} className="min-h-[44px] flex-row items-center gap-2">
                  <View className="min-w-0 flex-1">
                    <ProfileRow name={name} meta={meta} />
                  </View>
                  <Button
                    size="sm"
                    loading={actingId === m.user_id}
                    disabled={Boolean(actingId) && actingId !== m.user_id}
                    onPress={() => place(m.user_id)}
                    accessibilityLabel={`Placer ${name} sur ${slot?.position ?? "ce poste"}`}
                  >
                    Placer
                  </Button>
                </View>
              );
            })}
          </View>
        )}

        <Button variant="secondary" onPress={inviteFromLive} accessibilityLabel="Inviter un joueur depuis le LIVE">
          Inviter un joueur
        </Button>
      </View>
    </Sheet>
  );
}

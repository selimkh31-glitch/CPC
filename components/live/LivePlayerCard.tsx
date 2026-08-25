import { Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { PlayerCard } from "@/components/player/PlayerCard";
import { Button } from "@/components/ui/Button";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { buildPlayerCardData } from "@/lib/playerCard";
import type { PlayerSessionRow } from "@/lib/types";

/**
 * LIVE — même carte compacte que recrutement / recherche.
 * PulseDot + countdown + Inviter restent autour de l'identité partagée.
 */
export function LivePlayerCard({
  item,
  inviteLabel,
  onInvite,
  inviting,
  clubName,
  clubId,
  needPositions,
}: {
  item: PlayerSessionRow;
  inviteLabel?: string;
  onInvite?: () => void;
  inviting?: boolean;
  clubName?: string | null;
  clubId?: string | null;
  needPositions?: readonly string[] | null;
}) {
  const user = item.user;
  if (!user) return null;

  const data = buildPlayerCardData(user, {
    clubName: clubName ?? null,
    clubId: clubId ?? null,
    live: true,
    liveNote: item.note,
    needPositions: needPositions ?? null,
  });

  return (
    <PlayerCard
      data={data}
      variant="compact"
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/profile/${user.id}`);
      }}
      rightSlot={<LiveCountdown expiresAt={item.expires_at} />}
      footer={
        <View>
          {item.note ? (
            <Text numberOfLines={2} className="mt-2 text-sm text-fg-muted">
              {item.note}
            </Text>
          ) : null}
          {onInvite ? (
            <View className="mt-3">
              <Button size="sm" loading={inviting} onPress={onInvite}>
                {inviteLabel ?? "Inviter"}
              </Button>
            </View>
          ) : null}
        </View>
      }
    />
  );
}

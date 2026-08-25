import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { PlayerCard } from "@/components/player/PlayerCard";
import { buildPlayerCardData, PLAYER_CARD_COPY } from "@/lib/playerCard";
import { LANGUAGE_LABELS, type PositionCode } from "@/lib/constants";
import type { UserRow } from "@/lib/types";

/**
 * Recherche club → joueur : densité COMPACT du même système.
 * Fit = poste correspondant (règle déterministe), jamais un %.
 */
export function PlayerResultCard({
  player,
  slotPosition,
  onInvite,
  inviting,
}: {
  player: UserRow;
  slotPosition: PositionCode;
  onInvite: () => void;
  inviting: boolean;
}) {
  const cardData = buildPlayerCardData(player, { needPositions: slotPosition });

  return (
    <PlayerCard
      data={cardData}
      variant="compact"
      footer={
        <View className="mt-3">
          {player.languages.length > 0 && (
            <Text className="text-xs text-fg-subtle">
              {player.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}
            </Text>
          )}
          <Button className="mt-3 min-h-[44px]" loading={inviting} onPress={onInvite}>
            {`${PLAYER_CARD_COPY.invite} sur ce poste`}
          </Button>
        </View>
      }
    />
  );
}

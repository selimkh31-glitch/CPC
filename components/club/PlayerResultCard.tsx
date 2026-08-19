import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PlayerCard } from "@/components/player/PlayerCard";
import { buildPlayerCardData } from "@/lib/playerCard";
import { POSITION_LABELS, LANGUAGE_LABELS, type PositionCode } from "@/lib/constants";
import type { UserRow } from "@/lib/types";

/**
 * Résultat de recherche club -> joueur (phase 4). Réutilise le PlayerCard
 * central (mission "Player Card", section 13-15) en variante "compact" —
 * même carte que partout ailleurs dans l'app, jamais un rendu dupliqué.
 * Props externes inchangées (aucun appelant à modifier) : app/player-search.tsx.
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
  const isPrimaryMatch = player.main_position === slotPosition;
  const cardData = buildPlayerCardData(player);

  return (
    <PlayerCard
      data={cardData}
      variant="compact"
      rightSlot={
        <Badge tone={isPrimaryMatch ? "accent" : "neutral"}>
          {`${POSITION_LABELS[slotPosition]}${isPrimaryMatch ? " (principal)" : ""}`}
        </Badge>
      }
      footer={
        <View className="mt-3">
          {player.secondary_positions.length > 0 && (
            <Text className="text-xs text-fg-subtle">
              Aussi : {player.secondary_positions.map((p) => POSITION_LABELS[p as PositionCode] ?? p).join(", ")}
            </Text>
          )}
          {player.languages.length > 0 && (
            <Text className="mt-1 text-xs text-fg-subtle">
              {player.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}
            </Text>
          )}
          <Button size="sm" className="mt-3" loading={inviting} onPress={onInvite}>
            Inviter sur ce poste
          </Button>
        </View>
      }
    />
  );
}

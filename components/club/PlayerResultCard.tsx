import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { POSITION_LABELS, LANGUAGE_LABELS, type PositionCode } from "@/lib/constants";
import type { UserRow } from "@/lib/types";

/** Résultat de recherche club -> joueur (phase 4). Réutilise Card/Badge/Button existants. */
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

  return (
    <Card>
      <Pressable onPress={() => router.push(`/profile/${player.id}`)} className="active:opacity-80">
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-lg text-fg">{player.username}</Text>
          <Badge tone={isPrimaryMatch ? "accent" : "neutral"}>
            {`${POSITION_LABELS[player.main_position]}${isPrimaryMatch ? " (principal)" : ""}`}
          </Badge>
        </View>
        {player.secondary_positions.length > 0 && (
          <Text className="mt-1 text-xs text-fg-subtle">
            Aussi : {player.secondary_positions.map((p) => POSITION_LABELS[p as PositionCode] ?? p).join(", ")}
          </Text>
        )}
        {player.languages.length > 0 && (
          <Text className="mt-1 text-xs text-fg-subtle">
            {player.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}
          </Text>
        )}
      </Pressable>
      <Button size="sm" className="mt-3" loading={inviting} onPress={onInvite}>
        Inviter sur ce poste
      </Button>
    </Card>
  );
}

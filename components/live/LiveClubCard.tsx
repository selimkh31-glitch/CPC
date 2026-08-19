import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Globe2, Zap } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PulseDot } from "@/components/ui/PulseDot";
import { Button } from "@/components/ui/Button";
import { CLUB_LEVEL_LABELS, LANGUAGE_LABELS, POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import type { ClubSessionRow } from "@/lib/types";

export function LiveClubCard({ item }: { item: ClubSessionRow }) {
  if (!item.club) return null;
  const club = item.club;

  const openClub = () => {
    Haptics.selectionAsync();
    router.push(`/club/${club.id}?session=${item.id}`);
  };

  return (
    <Pressable onPress={openClub} className="active:opacity-90">
      <Card>
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2 shrink">
            <PulseDot />
            <Text numberOfLines={1} className="font-display text-lg text-fg shrink">
              {club.name}
            </Text>
          </View>
          <Badge tone={club.level === "COMPETITIVE" ? "accent" : "neutral"}>
            {CLUB_LEVEL_LABELS[club.level]}
          </Badge>
        </View>

        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {item.needed_positions.map((pos) => (
            <Badge key={pos} tone="pro">
              {POSITION_LABELS[pos as PositionCode] ?? pos}
            </Badge>
          ))}
        </View>

        {item.note && (
          <Text numberOfLines={2} className="mt-2 text-sm text-fg-muted">
            {item.note}
          </Text>
        )}

        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5 shrink">
            <Globe2 size={13} color="#666c74" />
            <Text numberOfLines={1} className="text-xs text-fg-subtle shrink">
              {club.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")} · {timeAgo(item.updated_at)}
            </Text>
          </View>
          <Button size="sm" onPress={openClub}>
            Postuler
          </Button>
        </View>
      </Card>
    </Pressable>
  );
}

import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Card } from "@/components/ui/Card";
import { PulseDot } from "@/components/ui/PulseDot";
import { Button } from "@/components/ui/Button";
import { CLUB_LEVEL_LABELS, PLATFORM_LABELS, POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Carte opportunité LIVE — données réelles uniquement.
 * `reason` vient du moteur déterministe (poste recherché · même plateforme), jamais un %.
 */
export function LiveClubCard({ item, reason }: { item: ClubSessionRow; reason?: string }) {
  if (!item.club) return null;
  const club = item.club;
  const platform = club.owner?.platform ? PLATFORM_LABELS[club.owner.platform] : null;
  const needed = item.needed_positions
    .map((pos) => POSITION_LABELS[pos as PositionCode] ?? pos)
    .join(" · ");

  const openClub = () => {
    Haptics.selectionAsync();
    router.push(`/club/${club.id}?session=${item.id}`);
  };

  return (
    <Pressable onPress={openClub} className="active:opacity-90" accessibilityRole="button">
      <Card className="p-3.5">
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <PulseDot />
            <Text numberOfLines={1} className="font-display text-lg text-fg">
              {club.name}
            </Text>
          </View>
          <LiveCountdown expiresAt={item.expires_at} />
        </View>

        {needed ? (
          <Text numberOfLines={1} className="mt-1.5 text-sm font-semibold text-fg">
            Cherche {needed}
          </Text>
        ) : null}

        <Text numberOfLines={1} className="mt-0.5 text-xs text-fg-muted">
          {[platform, CLUB_LEVEL_LABELS[club.level] ?? club.level].filter(Boolean).join(" · ")}
        </Text>

        {reason ? (
          <Text numberOfLines={1} className="mt-1 text-[11px] text-fg-subtle">
            {reason}
          </Text>
        ) : null}

        {item.note ? (
          <Text numberOfLines={1} className="mt-1 text-xs text-fg-muted">
            {item.note}
          </Text>
        ) : null}

        <View className="mt-3 flex-row gap-2">
          <Button size="sm" variant="secondary" onPress={openClub} className="flex-1">
            Voir le club
          </Button>
          <Button size="sm" onPress={openClub} className="flex-1">
            Postuler
          </Button>
        </View>
      </Card>
    </Pressable>
  );
}

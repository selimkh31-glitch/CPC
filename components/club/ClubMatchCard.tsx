import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PulseDot } from "@/components/ui/PulseDot";
import { POSITION_LABELS, CLUB_LEVEL_LABELS, LANGUAGE_LABELS, type PositionCode } from "@/lib/constants";
import { isLiveActive } from "@/lib/live";
import { clubPublicHref } from "@/lib/clubProfile";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import type { ClubMatch } from "@/lib/hooks/useClubSearch";

/**
 * Résultat de recherche joueur -> club. Tap = page publique `/club/[id]`
 * (ApplyForm si LIVE). Pas `/match-sheet` : ClubHome est lecture seule, sans candidature.
 */
export function ClubMatchCard({ match }: { match: ClubMatch }) {
  const now = useLiveClock();
  const { club, formationId, openSlots } = match;
  const isLive = club.sessions?.some((s) => isLiveActive(s, now)) ?? false;

  return (
    <Pressable
      onPress={() => router.push(clubPublicHref(club.id))}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${club.name}`}
      className="active:opacity-90"
    >
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            {isLive && <PulseDot />}
            <Text className="font-display text-lg text-fg">{club.name}</Text>
          </View>
          <Badge tone={club.level === "COMPETITIVE" ? "accent" : "neutral"}>{CLUB_LEVEL_LABELS[club.level]}</Badge>
        </View>
        <Text className="mt-1 text-xs text-fg-subtle">
          {formationId}
          {club.owner?.username ? ` · Owner : ${club.owner.username}` : ""}
        </Text>
        {club.languages?.length > 0 && (
          <Text className="mt-0.5 text-xs text-fg-subtle">{club.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}</Text>
        )}
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {openSlots.map((slot) => (
            <Badge key={slot.slotId} tone="pro">
              {`${POSITION_LABELS[slot.position as PositionCode] ?? slot.position} disponible`}
            </Badge>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

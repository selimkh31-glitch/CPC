import { Text, View } from "react-native";
import { router } from "expo-router";
import { ClubCard } from "@/components/club/ClubCard";
import { Badge } from "@/components/ui/Badge";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { isLiveActive } from "@/lib/live";
import { clubPublicHref } from "@/lib/clubProfile";
import { buildClubCardData } from "@/lib/clubCard";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import type { ClubMatch } from "@/lib/hooks/useClubSearch";

/**
 * Résultat de recherche joueur -> club. Tap = page publique `/club/[id]`
 * (Rejoindre le club si LIVE). La feuille `/match-sheet` vient après membership.
 */
export function ClubMatchCard({ match }: { match: ClubMatch }) {
  const now = useLiveClock();
  const { club, formationId, openSlots } = match;
  const liveSession = club.sessions?.find((s) => isLiveActive(s, now));
  const data = buildClubCardData(club, {
    ownerUsername: club.owner?.username ?? null,
    live: Boolean(liveSession),
    liveExpiresAt: liveSession?.expires_at ?? null,
  });

  return (
    <ClubCard
      data={data}
      variant="compact"
      onPress={() => router.push(clubPublicHref(club.id))}
      footer={
        <View className="mt-2 gap-1.5">
          <Text className="text-xs text-fg-subtle">{formationId}</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {openSlots.map((slot) => (
              <Badge key={slot.slotId} tone="pro">
                {`${POSITION_LABELS[slot.position as PositionCode] ?? slot.position} disponible`}
              </Badge>
            ))}
          </View>
        </View>
      }
    />
  );
}

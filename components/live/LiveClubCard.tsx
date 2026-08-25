import { View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ClubCard } from "@/components/club/ClubCard";
import { Button } from "@/components/ui/Button";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { CLUB_CARD_COPY, buildClubCardDataFromLiveSession } from "@/lib/clubCard";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Carte opportunité LIVE — même ClubCard compacte que l'annuaire.
 * PulseDot + countdown + un seul CTA « Voir le club ». `reason` déterministe, jamais un %.
 */
export function LiveClubCard({ item, reason }: { item: ClubSessionRow; reason?: string }) {
  const data = buildClubCardDataFromLiveSession(item, { reason });
  if (!data) return null;

  const openClub = () => {
    Haptics.selectionAsync();
    router.push(data.href);
  };

  return (
    <ClubCard
      data={data}
      variant="compact"
      onPress={openClub}
      rightSlot={<LiveCountdown expiresAt={item.expires_at} />}
      footer={
        <View className="mt-3">
          <Button size="sm" onPress={openClub}>
            {CLUB_CARD_COPY.viewClub}
          </Button>
        </View>
      }
    />
  );
}

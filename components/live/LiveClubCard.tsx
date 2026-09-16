import { Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { MatchReasonBadge } from "@/components/ui/MatchReasonBadge";
import { buildClubLiveRowMeta } from "@/lib/clubLiveRow";
import { clubPublicHref } from "@/lib/clubProfile";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Ligne Matchmaking — LIVE, avatar, nom + meta, Rejoindre à droite.
 * Rangée unique, sans carte club, postes recherchés, timer ni second CTA.
 */
export function LiveClubCard({
  item,
  memberCount,
  form,
  reason,
}: {
  item: ClubSessionRow;
  memberCount?: number | null;
  form?: string | null;
  reason?: string;
}) {
  const club = item.club;
  const name = club?.name?.trim();
  if (!club || !name) return null;

  const href = clubPublicHref(club.id, item.id);
  const meta = buildClubLiveRowMeta({
    languages: club.languages,
    level: club.level,
    memberCount,
    form,
    clubId: club.id,
  });

  const join = () => {
    Haptics.selectionAsync();
    router.push(href);
  };

  return (
    <View className="min-h-[44px] flex-row items-center gap-2">
      <LiveBadge />
      <Avatar username={name} size="sm" />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-sans-medium text-body text-fg">
          {name}
          {meta ? `  ${meta}` : ""}
        </Text>
        {reason ? <MatchReasonBadge className="mt-1">{reason}</MatchReasonBadge> : null}
      </View>
      <Button size="sm" onPress={join} accessibilityLabel="Rejoindre">
        Rejoindre
      </Button>
    </View>
  );
}

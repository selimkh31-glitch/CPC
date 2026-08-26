import { Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { PulseDot } from "@/components/ui/PulseDot";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { buildClubLiveRowMeta } from "@/lib/clubLiveRow";
import { clubPublicHref } from "@/lib/clubProfile";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Ligne Matchmaking — PulseDot, avatar, nom + meta, Rejoindre à droite.
 * Rangée unique, sans carte club, postes recherchés, timer ni second CTA.
 */
export function LiveClubCard({
  item,
  memberCount,
  form,
}: {
  item: ClubSessionRow;
  memberCount?: number | null;
  form?: string | null;
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
      <PulseDot />
      <Avatar username={name} size="sm" />
      <Text numberOfLines={1} className="min-w-0 flex-1 text-[14px] font-medium text-fg">
        {name}
        {meta ? `  ${meta}` : ""}
      </Text>
      <Button size="sm" onPress={join} accessibilityLabel="Rejoindre">
        Rejoindre
      </Button>
    </View>
  );
}

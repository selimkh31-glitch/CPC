import { Text, View } from "react-native";
import { PulseDot } from "@/components/ui/PulseDot";
import { Avatar } from "@/components/ui/Avatar";
import { JoinLiveClubButton } from "@/components/club/JoinLiveClubButton";
import { buildClubLiveRowMeta } from "@/lib/clubLiveRow";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Ligne Matchmaking — PulseDot, avatar, nom + meta, Rejoindre à droite.
 * Rejoindre = membership MEMBER puis feuille (`join-live-club`), pas `apply`.
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

  const meta = buildClubLiveRowMeta({
    languages: club.languages,
    level: club.level,
    memberCount,
    form,
    clubId: club.id,
  });

  return (
    <View className="min-h-[44px] flex-row items-center gap-2">
      <PulseDot />
      <Avatar username={name} size="sm" />
      <Text numberOfLines={1} className="min-w-0 flex-1 text-[14px] font-medium text-fg">
        {name}
        {meta ? `  ${meta}` : ""}
      </Text>
      <JoinLiveClubButton clubId={club.id} label="Rejoindre" size="sm" />
    </View>
  );
}

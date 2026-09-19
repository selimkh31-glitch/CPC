import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { MatchReasonBadge } from "@/components/ui/MatchReasonBadge";
import { buildClubLiveRowMeta } from "@/lib/clubLiveRow";
import { clubPublicHref } from "@/lib/clubProfile";
import { cpcHex } from "@/lib/design/cpc-native";
import { usePlayerJoinCta } from "@/lib/hooks/usePlayerJoinCta";
import { formatNeededPositionsLine } from "@/lib/sessionState";
import { PLAYER_JOIN_COPY } from "@/lib/playerJoinCta";
import { isClubHiddenByBlock } from "@/lib/safety";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useBlockedUserIds } from "@/lib/hooks/useSafety";
import type { ClubSessionRow } from "@/lib/types";

/**
 * Ligne Matchmaking — tap / Voir = aperçu club (feuille + membres).
 * Rejoindre = même aperçu avec le formulaire de candidature PENDING ouvert.
 * Jamais d'auto-membre, jamais d'auto-slot.
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
  const { session } = useAuth();
  const { data: blockedIds } = useBlockedUserIds(session?.user.id ?? null);
  const blocked = club ? isClubHiddenByBlock(club, blockedIds ?? []) : false;
  const join = usePlayerJoinCta({
    clubId: club?.id,
    session: item,
    neededPositions: item.needed_positions,
    blocked,
  });
  if (!club || !name) return null;

  const previewHref = clubPublicHref(club.id, item.id);
  const joinHref = clubPublicHref(club.id, item.id, { join: true });
  const needed = formatNeededPositionsLine(item.needed_positions);
  const meta = buildClubLiveRowMeta({
    languages: club.languages,
    level: club.level,
    memberCount,
    form,
    clubId: club.id,
  });

  const openPreview = () => {
    Haptics.selectionAsync();
    router.push(previewHref);
  };

  const openJoin = () => {
    Haptics.selectionAsync();
    router.push(joinHref);
  };

  return (
    <Pressable
      onPress={openPreview}
      accessibilityRole="button"
      accessibilityLabel={`Aperçu ${name}`}
      className="min-h-[44px] gap-2 active:opacity-80"
    >
      <View className="flex-row items-center gap-2">
        <LiveBadge />
        <Avatar username={name} size="sm" />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-sans-medium text-body text-fg" style={{ color: cpcHex.textPrimary }}>
            {name}
            {meta ? `  ${meta}` : ""}
          </Text>
          {needed ? (
            <Text numberOfLines={1} className="mt-0.5 font-sans text-caption text-fg-muted">
              {needed}
            </Text>
          ) : null}
          {reason ? <MatchReasonBadge className="mt-1">{reason}</MatchReasonBadge> : null}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Button size="sm" variant="secondary" onPress={openPreview} accessibilityLabel="Voir le club">
          {PLAYER_JOIN_COPY.voir}
        </Button>
        {join.showJoin ? (
          <Button size="sm" onPress={openJoin} accessibilityLabel={PLAYER_JOIN_COPY.rejoindre}>
            {PLAYER_JOIN_COPY.rejoindre}
          </Button>
        ) : join.message ? (
          <Text className="min-w-0 flex-1 font-sans text-caption text-fg-muted">{join.message}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

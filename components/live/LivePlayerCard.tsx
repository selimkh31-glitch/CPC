import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PulseDot } from "@/components/ui/PulseDot";
import { Button } from "@/components/ui/Button";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { POSITION_LABELS, PLATFORM_LABELS } from "@/lib/constants";
import type { PlayerSessionRow } from "@/lib/types";

export function LivePlayerCard({
  item,
  inviteLabel,
  onInvite,
  inviting,
}: {
  item: PlayerSessionRow;
  inviteLabel?: string;
  onInvite?: () => void;
  inviting?: boolean;
}) {
  const user = item.user;
  if (!user) return null;

  const openProfile = () => {
    Haptics.selectionAsync();
    router.push(`/profile/${user.id}`);
  };

  return (
    <Pressable onPress={openProfile} className="active:opacity-90">
      <Card>
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2 shrink">
            <PulseDot />
            <Text numberOfLines={1} className="font-display text-lg text-fg shrink">
              {user.username}
            </Text>
          </View>
          <LiveCountdown expiresAt={item.expires_at} />
        </View>
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          <Badge tone="pro">{POSITION_LABELS[user.main_position]}</Badge>
          <Badge tone="neutral">{PLATFORM_LABELS[user.platform]}</Badge>
        </View>
        {item.note ? (
          <Text numberOfLines={2} className="mt-2 text-sm text-fg-muted">
            {item.note}
          </Text>
        ) : null}
        {onInvite ? (
          <View className="mt-3">
            <Button size="sm" loading={inviting} onPress={onInvite}>
              {inviteLabel ?? "Inviter"}
            </Button>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

import { Pressable, Text, View } from "react-native";
import { Bell, ChevronRight } from "lucide-react-native";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { timeAgo } from "@/lib/utils";

export function NotificationRow({
  title,
  body,
  at,
  read,
  onPress,
}: {
  title: string;
  body?: string;
  at: string | Date;
  read?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={`min-h-[44px] border p-3 active:opacity-80 ${read ? "border-border bg-bg-card" : "border-accent/30 bg-accent/10"}`}
    >
      <View className="flex-row items-start gap-2">
        <Bell size={cpcTokens.icon.sm} color={read ? cpcHex.textMuted : cpcHex.accent} />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-body text-fg">{title}</Text>
          {body ? <Text className="mt-0.5 font-sans text-bodySmall text-fg-muted">{body}</Text> : null}
          <Text className="mt-1 font-sans text-caption text-fg-subtle">{timeAgo(at)}</Text>
        </View>
        <ChevronRight size={cpcTokens.icon.sm} color={cpcHex.disabled} />
      </View>
    </Pressable>
  );
}

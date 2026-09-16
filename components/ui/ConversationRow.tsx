import { Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";

export function ConversationRow({
  label,
  preview,
  when,
  unread,
  onPress,
}: {
  label: string;
  preview?: string | null;
  when: string | Date;
  unread?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${label}`}
      className="min-h-[64px] flex-row items-center gap-3 py-3 active:opacity-80"
    >
      <Avatar username={label} size="md" />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-display text-base text-fg">
          {label}
        </Text>
        {preview ? (
          <Text numberOfLines={1} className={unread ? "mt-0.5 text-sm text-fg-muted" : "mt-0.5 text-sm text-fg-subtle"}>
            {preview}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1.5">
        <Text className="text-caption text-fg-subtle">{timeAgo(when)}</Text>
        {unread ? <View className="h-2 w-2 rounded-full bg-accent" accessibilityLabel="Non lu" /> : null}
      </View>
    </Pressable>
  );
}

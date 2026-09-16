import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

export function ActivityRow({
  title,
  subtitle,
  at,
  onPress,
  unread,
}: {
  title: string;
  subtitle?: string;
  at?: string | Date;
  onPress?: () => void;
  unread?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      className={cn(
        "min-h-[44px] justify-center border border-border bg-bg-card px-3 py-3 active:opacity-80",
        unread && "border-accent/30 bg-accent/10"
      )}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-body text-fg">{title}</Text>
          {subtitle ? <Text className="mt-0.5 font-sans text-bodySmall text-fg-muted">{subtitle}</Text> : null}
        </View>
        {at ? <Text className="font-sans text-caption text-fg-subtle">{timeAgo(at)}</Text> : null}
      </View>
    </Pressable>
  );
}

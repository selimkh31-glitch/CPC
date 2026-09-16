import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  className,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <View className={cn("min-h-[44px] flex-row items-center justify-between gap-3", className)}>
      <Text
        className="min-w-0 flex-1 font-sans-semibold text-eyebrow uppercase text-fg-muted"
        style={{ letterSpacing: cpcTokens.font.letterSpacing.eyebrow }}
      >
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} className="min-h-[44px] justify-center">
          <Text className="font-sans-semibold text-bodySmall text-accent">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

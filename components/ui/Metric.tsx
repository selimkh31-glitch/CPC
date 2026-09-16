import { Text, View } from "react-native";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

export function Metric({
  value,
  label,
  className,
}: {
  value: string | number;
  label: string;
  className?: string;
}) {
  return (
    <View className={cn("min-w-0 flex-1", className)}>
      <Text className="font-display text-title text-fg">{value}</Text>
      <Text
        numberOfLines={1}
        className="mt-0.5 font-sans-medium text-caption uppercase text-fg-muted"
        style={{ letterSpacing: cpcTokens.font.letterSpacing.eyebrow }}
      >
        {label}
      </Text>
    </View>
  );
}

import { Text, View } from "react-native";
import { cn } from "@/lib/utils";

export function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <View className={cn("min-h-[44px] flex-row items-center justify-between gap-3 bg-bg-elevated px-3 py-2.5", className)}>
      <Text className="font-sans text-caption uppercase text-fg-subtle">{label}</Text>
      <Text className="min-w-0 flex-1 text-right font-sans-bold text-bodySmall text-fg" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

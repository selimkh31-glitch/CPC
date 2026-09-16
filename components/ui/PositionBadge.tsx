import { Text, View } from "react-native";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

export function PositionBadge({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <View
      className={cn("self-start border border-border bg-bg-secondary px-1.5 py-0.5", className)}
      style={{ borderRadius: cpcTokens.radius.badge }}
    >
      <Text className="font-sans-bold text-micro uppercase tracking-wide text-fg">{children}</Text>
    </View>
  );
}

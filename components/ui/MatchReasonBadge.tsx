import { Text, View } from "react-native";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

export function MatchReasonBadge({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <View
      className={cn("self-start border border-accent/30 bg-accent/10 px-2 py-1", className)}
      style={{ borderRadius: cpcTokens.radius.badge }}
    >
      <Text className="font-sans-medium text-caption text-accent">{children}</Text>
    </View>
  );
}

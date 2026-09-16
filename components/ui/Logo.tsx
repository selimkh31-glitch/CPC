import { Text, View } from "react-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const text =
    size === "lg" ? "font-display text-displayLarge" : size === "sm" ? "font-display text-titleSmall" : "font-display text-display";
  return (
    <View className={cn("items-center", className)} accessibilityRole="image" accessibilityLabel="ClubPro Connect">
      <Text className={cn("uppercase text-fg", text)} style={{ letterSpacing: cpcTokens.font.letterSpacing.brand }}>
        Club<Text className="text-accent">Pro</Text>
      </Text>
      <Text className="mt-1 font-sans-medium text-eyebrow uppercase text-fg-muted" style={{ letterSpacing: cpcTokens.font.letterSpacing.eyebrow }}>
        Connect
      </Text>
    </View>
  );
}

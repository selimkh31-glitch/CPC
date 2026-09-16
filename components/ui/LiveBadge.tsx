import { View, Text } from "react-native";
import { PulseDot } from "@/components/ui/PulseDot";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

export function LiveBadge({ className }: { className?: string }) {
  return (
    <View
      className={cn("flex-row items-center gap-1.5 self-start border border-live/40 bg-live/10 px-2 py-1", className)}
      style={{ borderRadius: cpcTokens.radius.badge }}
      accessibilityRole="text"
      accessibilityLabel="LIVE"
    >
      <PulseDot tone="live" />
      <Text
        className="font-sans-bold text-caption uppercase text-live"
        style={{ letterSpacing: cpcTokens.font.letterSpacing.eyebrow }}
      >
        LIVE
      </Text>
    </View>
  );
}

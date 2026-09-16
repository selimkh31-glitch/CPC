import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { MotiView } from "moti";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

/** Indicateur LIVE qui pulse — Moti/Reanimated. Respecte la réduction des animations. */
export function PulseDot({ className, tone = "accent" }: { className?: string; tone?: "accent" | "live" }) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    return () => sub.remove();
  }, []);

  const fill = tone === "live" ? "bg-live" : "bg-accent";

  return (
    <View className={cn("h-2.5 w-2.5 items-center justify-center", className)}>
      {reduce ? null : (
        <MotiView
          from={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 0, scale: 2.4 }}
          transition={{ type: "timing", duration: cpcTokens.motion.livePulse, loop: true }}
          className={cn("absolute h-2.5 w-2.5 rounded-full", fill)}
        />
      )}
      <View className={cn("h-2.5 w-2.5 rounded-full", fill)} />
    </View>
  );
}

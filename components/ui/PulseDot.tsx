import { View } from "react-native";
import { MotiView } from "moti";
import { cn } from "@/lib/utils";

/** Indicateur "live" qui pulse (Moti/Reanimated natif) — feed, sessions, présence. */
export function PulseDot({ className }: { className?: string }) {
  return (
    <View className={cn("h-2.5 w-2.5 items-center justify-center", className)}>
      <MotiView
        from={{ opacity: 0.6, scale: 1 }}
        animate={{ opacity: 0, scale: 2.4 }}
        transition={{ type: "timing", duration: 1400, loop: true }}
        className="absolute h-2.5 w-2.5 rounded-full bg-accent"
      />
      <View className="h-2.5 w-2.5 rounded-full bg-accent" />
    </View>
  );
}

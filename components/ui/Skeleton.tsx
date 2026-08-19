import { MotiView } from "moti";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <MotiView
      from={{ opacity: 0.4 }}
      animate={{ opacity: 0.9 }}
      transition={{ type: "timing", duration: 800, loop: true }}
      className={cn("rounded-xl bg-bg-elevated", className)}
    />
  );
}

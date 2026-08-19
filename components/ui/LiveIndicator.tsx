import { Text } from "react-native";
import { Glow } from "@/components/ui/Glow";
import { PulseDot } from "@/components/ui/PulseDot";
import { cn } from "@/lib/utils";

/**
 * Badge LIVE cinématique (Phase G.2 section 4) — réutilise `PulseDot` tel
 * quel (components/ui/PulseDot.tsx, aucun doublon créé), habillé d'un halo
 * discret et d'un label pour les futurs écrans LIVE plein-bleed (G.3). Le
 * header actuel (app/(club)/(tabs)/match.tsx) garde son `PulseDot` nu,
 * inchangé — cette variante n'y est PAS substituée dans cette phase.
 */
export function LiveIndicator({ className }: { className?: string }) {
  return (
    <Glow
      tone="accent"
      intensity="sm"
      className={cn(
        "flex-row items-center gap-2 self-start rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5",
        className
      )}
    >
      <PulseDot />
      <Text className="text-xs font-extrabold uppercase tracking-widest text-accent">Live</Text>
    </Glow>
  );
}

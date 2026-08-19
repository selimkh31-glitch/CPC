import { View, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { cn } from "@/lib/utils";

type CinematicTone = "neutral" | "accent" | "win" | "draw" | "loss";

// Deux couleurs [haut, bas] pour un dégradé subtil teinté par tone, qui
// retombe toujours sur la surface carte standard — même technique que
// RARITY_GRADIENT dans components/profile/ClubProCard.tsx, généralisée.
const TONE_GRADIENT: Record<CinematicTone, [string, string]> = {
  neutral: ["#16191d", "#131519"],
  accent: ["#39ff8a26", "#131519"],
  win: ["#39ff8a33", "#131519"],
  draw: ["#f5a62333", "#131519"],
  loss: ["#ff4d4f26", "#131519"],
};

const TONE_BORDER: Record<CinematicTone, string> = {
  neutral: "border-border",
  accent: "border-accent/40",
  win: "border-outcome-win/50",
  draw: "border-outcome-draw/50",
  loss: "border-outcome-loss/40",
};

/**
 * Carte cinématique (Phase G.2 section 4) — même technique visuelle que
 * ClubProCard (gradient de fond teinté + bordure 2px colorée + entrée Moti),
 * généralisée par `tone` pour les futurs écrans LIVE/RESULT/HISTORY
 * (G.3-G.7). Composant neuf, N'IMPORTE PAS et ne remplace pas `Card`
 * (components/ui/Card.tsx, inchangé, continue de servir tous les écrans
 * actuels) — à adopter explicitement dans les phases suivantes.
 */
export function CinematicCard({
  tone = "neutral",
  animateIn = true,
  className,
  children,
  ...props
}: ViewProps & { tone?: CinematicTone; animateIn?: boolean; className?: string }) {
  const content = (
    <View className={cn("overflow-hidden rounded-3xl border-2", TONE_BORDER[tone])} {...props}>
      <LinearGradient colors={TONE_GRADIENT[tone]} className={cn("p-5", className)}>
        {children}
      </LinearGradient>
    </View>
  );

  if (!animateIn) return content;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 500 }}
    >
      {content}
    </MotiView>
  );
}

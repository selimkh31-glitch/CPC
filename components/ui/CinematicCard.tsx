import { View, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { cn } from "@/lib/utils";
import { useModeAccent } from "@/lib/theme";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

type CinematicTone = "neutral" | "accent" | "win" | "draw" | "loss";

const TONE_GRADIENT: Record<CinematicTone, [string, string]> = {
  neutral: [cpcHex.elevated, cpcHex.card],
  accent: [`${cpcHex.accent}26`, cpcHex.card],
  win: [`${cpcHex.success}33`, cpcHex.card],
  draw: [`${cpcHex.warning}33`, cpcHex.card],
  loss: [`${cpcHex.error}26`, cpcHex.card],
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
  const modeAccent = useModeAccent();
  const gradient: [string, string] = tone === "accent" ? [`${modeAccent}26`, cpcHex.card] : TONE_GRADIENT[tone];
  const content = (
    <View className={cn("overflow-hidden border-2", TONE_BORDER[tone])} style={{ borderRadius: cpcTokens.radius.card }} {...props}>
      <LinearGradient colors={gradient} className={cn("p-5", className)}>
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

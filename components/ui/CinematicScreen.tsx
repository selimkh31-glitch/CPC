import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";
import { useModeAccent } from "@/lib/theme";
import { cpcHex } from "@/lib/design/cpc-native";

type AmbientTone = "none" | "accent" | "win" | "draw" | "loss";

const AMBIENT_COLORS: Record<Exclude<AmbientTone, "none">, string> = {
  accent: cpcHex.accent,
  win: cpcHex.success,
  draw: cpcHex.warning,
  loss: cpcHex.error,
};

/**
 * Conteneur plein-bleed pour les écrans "moment" (Phase G.2 section 4) —
 * LIVE (G.3), RESULT (G.4) : fond dark uniforme + wash ambiant optionnel en
 * haut d'écran. Distinct de `Screen` (components/ui/Screen.tsx, scroll +
 * form-like, toujours utilisé par tous les écrans actuels, inchangé) —
 * `CinematicScreen` est réservé aux futurs écrans "une action, un moment",
 * pas substitué dans l'existant ici. `ambient` reste optionnel et discret
 * (opacité ~13%) : le vert doit rester rare et stratégique (consigne G.2).
 */
export function CinematicScreen({
  ambient = "none",
  safeArea = true,
  className,
  children,
}: {
  ambient?: AmbientTone;
  /**
   * Phase G.3 — `false` quand ce conteneur est imbriqué dans un
   * `SafeAreaView` parent déjà présent (ex: match.tsx) : évite d'appliquer
   * l'inset deux fois (react-native-safe-area-context ne "consomme" pas les
   * insets déjà pris en compte par un ancêtre — un `SafeAreaView` imbriqué
   * réapplique le padding, d'où un décalage visible en haut d'écran).
   */
  safeArea?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Container = safeArea ? SafeAreaView : View;
  const modeAccent = useModeAccent();
  const wash = ambient === "none" ? null : ambient === "accent" ? modeAccent : AMBIENT_COLORS[ambient];
  return (
    <Container className={cn("flex-1 bg-bg", className)}>
      {wash && (
        <LinearGradient
          pointerEvents="none"
          colors={[`${wash}22`, "transparent"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
        />
      )}
      <View className="flex-1 px-4">{children}</View>
    </Container>
  );
}

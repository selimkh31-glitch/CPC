import { View, type ViewProps } from "react-native";

type GlowTone = "accent" | "win" | "draw" | "loss" | "ambient";
type GlowIntensity = "sm" | "md" | "lg";

const GLOW_COLORS: Record<GlowTone, string> = {
  accent: "#39ff8a",
  win: "#39ff8a",
  draw: "#f5a623",
  loss: "#ff4d4f",
  ambient: "#39ff8a",
};

const SPREAD: Record<GlowIntensity, number> = { sm: 8, md: 16, lg: 26 };

/**
 * Halo coloré réutilisable (Phase G.2 section 3) — React Native n'a pas de
 * drop-shadow coloré fiable cross-platform (l'`elevation` Android est
 * toujours grise, jamais teintée). On simule un glow via deux couches
 * translucides superposées, agrandies et de plus en plus transparentes
 * derrière le contenu — identique iOS/Android, aucune dépendance native
 * supplémentaire (juste des `View` + opacité).
 *
 * Composable : `className`/`style` s'appliquent au conteneur EXTERNE (donc
 * au layout du contenu réel), les halos sont des `View` absolues purement
 * décoratives placées avant `children` (donc rendues derrière, ordre
 * d'empilement RN par défaut). Prévu pour des éléments compacts/arrondis
 * (badge LIVE, badge outcome, futur CTA héros) — pas pour une carte
 * rectangulaire large (voir CinematicCard pour la profondeur de carte).
 */
export function Glow({
  tone = "accent",
  intensity = "md",
  className,
  style,
  children,
  ...props
}: ViewProps & { tone?: GlowTone; intensity?: GlowIntensity; className?: string }) {
  const color = GLOW_COLORS[tone];
  const spread = SPREAD[intensity];

  return (
    <View className={className} style={style} {...props}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -spread,
          bottom: -spread,
          left: -spread,
          right: -spread,
          borderRadius: 9999,
          backgroundColor: color,
          opacity: 0.16,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -spread / 2,
          bottom: -spread / 2,
          left: -spread / 2,
          right: -spread / 2,
          borderRadius: 9999,
          backgroundColor: color,
          opacity: 0.12,
        }}
      />
      {children}
    </View>
  );
}

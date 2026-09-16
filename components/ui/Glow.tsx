import { View, type ViewProps } from "react-native";
import { useModeAccent } from "@/lib/theme";
import { cpcHex } from "@/lib/design/cpc-native";

type GlowTone = "accent" | "win" | "draw" | "loss" | "ambient" | "live";
type GlowIntensity = "sm" | "md" | "lg";

const GLOW_COLORS: Record<GlowTone, string> = {
  accent: cpcHex.accent,
  win: cpcHex.success,
  draw: cpcHex.warning,
  loss: cpcHex.error,
  ambient: cpcHex.accent,
  live: cpcHex.live,
};

const SPREAD: Record<GlowIntensity, number> = { sm: 8, md: 16, lg: 26 };

export function Glow({
  tone = "accent",
  intensity = "md",
  className,
  style,
  children,
  ...props
}: ViewProps & { tone?: GlowTone; intensity?: GlowIntensity; className?: string }) {
  const modeAccent = useModeAccent();
  const color = tone === "accent" || tone === "ambient" ? modeAccent : GLOW_COLORS[tone];
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

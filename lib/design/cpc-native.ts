import type { ViewStyle } from "react-native";
import type { CpcStatus } from "@/lib/design/cpc-tokens";
export { cpcTokens } from "@/lib/design/cpc-tokens";

/**
 * sRGB hex mirrors of `cpcTokens.color` for React Native / NativeWind.
 * Canonical values stay OKLCH in cpc-tokens.ts — RN StyleSheet does not paint OKLCH.
 */
export const cpcHex = {
  background: "#04080d",
  elevated: "#080e14",
  card: "#0c1219",
  secondary: "#141b23",
  border: "#2a3139",
  borderSubtle: "rgba(42,49,57,0.7)",
  textPrimary: "#f1f6f8",
  textSecondary: "#e7ecf0",
  textMuted: "#919da7",
  accent: "#54e182",
  accentForeground: "#020a05",
  live: "#f94144",
  success: "#5cd481",
  warning: "#fcb52c",
  error: "#ea3c3f",
  disabled: "#515962",
  overlay: "rgba(0,0,1,0.8)",
  pitch: "#0b2e1a",
  pitchDeep: "#021c0d",
  pitchLine: "#c4e0cc",
} as const;

export const cpcStatusColor: Record<CpcStatus, string> = {
  live: cpcHex.live,
  success: cpcHex.success,
  warning: cpcHex.warning,
  error: cpcHex.error,
  pending: cpcHex.warning,
  accepted: cpcHex.success,
  declined: cpcHex.error,
  expired: cpcHex.disabled,
  disabled: cpcHex.disabled,
};

export const cpcCardShadow: ViewStyle = {
  shadowColor: "#010206",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.22,
  shadowRadius: 16,
  elevation: 8,
};

export const cpcFocusShadow: ViewStyle = {
  shadowColor: cpcHex.accent,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.55,
  shadowRadius: 2,
  elevation: 2,
};

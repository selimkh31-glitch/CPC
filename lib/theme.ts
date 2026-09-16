import type { MatchOutcome } from "@/lib/types";
import type { Rarity } from "@/lib/ovr";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { cpcHex } from "@/lib/design/cpc-native";

/** Accent d'interface par mode. Joueur = bleu esport, Club = accent CPC. */
export const MODE_ACCENT = { PLAYER: "#4DA3FF", CLUB: cpcHex.accent } as const;

/** Accent du mode actif. Sans mode (porte / auth), défaut Joueur. */
export function useModeAccent(): string {
  const { mode } = useAppMode();
  return MODE_ACCENT[mode === "CLUB" ? "CLUB" : "PLAYER"];
}

/**
 * Palette CPC (handoff) en valeurs brutes — StyleSheet, LinearGradient, SVG.
 * Source canonique OKLCH : lib/design/cpc-tokens.ts
 */
export const CINEMATIC_COLORS = {
  bg: cpcHex.background,
  surface: cpcHex.card,
  surfaceElevated: cpcHex.elevated,
  border: cpcHex.border,
  accent: cpcHex.accent,
  live: cpcHex.live,
  fg: cpcHex.textPrimary,
  fgMuted: cpcHex.textMuted,
} as const;

export const OUTCOME_THEME: Record<MatchOutcome, { main: string; soft: string; text: string }> = {
  WIN: { main: cpcHex.success, soft: "rgba(92,212,129,0.12)", text: cpcHex.success },
  DRAW: { main: cpcHex.warning, soft: "rgba(252,181,44,0.12)", text: cpcHex.warning },
  LOSS: { main: cpcHex.error, soft: "rgba(234,60,63,0.12)", text: cpcHex.error },
};

export const OUTCOME_LABELS: Record<MatchOutcome, string> = {
  WIN: "Victoire",
  DRAW: "Match nul",
  LOSS: "Défaite",
};

export const RARITY_GRADIENT: Record<Rarity, [string, string]> = {
  bronze: ["#a3673a33", cpcHex.card],
  silver: ["#c0c5cc33", cpcHex.card],
  gold: ["#e8b84b40", cpcHex.card],
  icon: ["#39e6ff40", "#8b5cf633"],
};

export const RARITY_BORDER: Record<Rarity, string> = {
  bronze: "border-rarity-bronze/50",
  silver: "border-rarity-silver/50",
  gold: "border-rarity-gold/60",
  icon: "border-rarity-icon/60",
};

export const RARITY_TEXT: Record<Rarity, string> = {
  bronze: "text-rarity-bronze",
  silver: "text-rarity-silver",
  gold: "text-rarity-gold",
  icon: "text-rarity-icon",
};

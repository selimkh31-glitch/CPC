import type { MatchOutcome } from "@/lib/types";

/**
 * Palette Cinematic (Phase G.2) en valeurs brutes — pour tout ce qui ne peut
 * pas consommer les classes Tailwind (`LinearGradient colors={}`, `shadowColor`,
 * remplissages SVG). Mêmes valeurs que tailwind.config.js, à garder
 * synchronisées manuellement : même doctrine que `RARITY_GRADIENT` dans
 * components/profile/ClubProCard.tsx, généralisée ici pour être partagée par
 * les futurs écrans (G.3-G.7) plutôt que redupliquée composant par composant.
 */
export const CINEMATIC_COLORS = {
  bg: "#08090b",
  surface: "#131519",
  surfaceElevated: "#16191d",
  border: "#24272c",
  accent: "#39ff8a",
  fg: "#f4f5f7",
  fgMuted: "#9aa0a8",
} as const;

/**
 * Thème par issue de match — reprend exactement le mapping déjà utilisé (de
 * façon locale, non partagée) dans MatchCheckinPanel.tsx (OUTCOME_TONES) pour
 * lui donner une source unique consommable en JS. N'écrase ni ne modifie ce
 * fichier existant.
 */
export const OUTCOME_THEME: Record<MatchOutcome, { main: string; soft: string; text: string }> = {
  WIN: { main: "#39ff8a", soft: "rgba(57,255,138,0.12)", text: "#39ff8a" },
  DRAW: { main: "#f5a623", soft: "rgba(245,166,35,0.12)", text: "#f5a623" },
  LOSS: { main: "#ff4d4f", soft: "rgba(255,77,79,0.12)", text: "#ff4d4f" },
};

export const OUTCOME_LABELS: Record<MatchOutcome, string> = {
  WIN: "Victoire",
  DRAW: "Match nul",
  LOSS: "Défaite",
};

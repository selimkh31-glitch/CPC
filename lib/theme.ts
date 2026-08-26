import type { MatchOutcome } from "@/lib/types";
import type { Rarity } from "@/lib/ovr";
import { useAppMode } from "@/lib/providers/AppModeProvider";

/** Accent d'interface par mode. Joueur = bleu esport, Club = vert live. */
export const MODE_ACCENT = { PLAYER: "#4DA3FF", CLUB: "#39ff8a" } as const;

/** Accent du mode actif. Sans mode (porte / auth), défaut Joueur. */
export function useModeAccent(): string {
  const { mode } = useAppMode();
  return MODE_ACCENT[mode === "CLUB" ? "CLUB" : "PLAYER"];
}

/**
 * Palette Cinematic (Phase G.2) en valeurs brutes — pour tout ce qui ne peut
 * pas consommer les classes Tailwind (`LinearGradient colors={}`, `shadowColor`,
 * remplissages SVG). Mêmes valeurs que tailwind.config.js, à garder
 * synchronisées manuellement : même doctrine que `RARITY_GRADIENT` dans
 * components/profile/ClubProCard.tsx, généralisée ici pour être partagée par
 * les futurs écrans (G.3-G.7) plutôt que redupliquée composant par composant.
 * `accent` reste le vert Club ; le chrome JS LIVE suit `useModeAccent()`.
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

/**
 * Rareté visuelle (bronze/argent/or/icon) — valeurs identiques à
 * RARITY_GRADIENT/RARITY_BORDER/RARITY_TEXT définis localement dans
 * components/profile/ClubProCard.tsx (non modifié, jamais rétrofitté ici —
 * même doctrine que CINEMATIC_COLORS ci-dessus). Source canonique pour tout
 * NOUVEAU composant qui a besoin de ces couleurs (PlayerCard,
 * components/player/PlayerCard.tsx) plutôt que de les redupliquer une
 * troisième fois. Garder synchronisé manuellement avec ClubProCard.tsx si
 * l'un des deux change — Player Card, Phase 2 pourrait migrer ClubProCard
 * vers cette source unique.
 */
export const RARITY_GRADIENT: Record<Rarity, [string, string]> = {
  bronze: ["#a3673a33", "#131519"],
  silver: ["#c0c5cc33", "#131519"],
  gold: ["#e8b84b40", "#131519"],
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

/**
 * Calcul de l'OVR (note globale) affichée sur la ClubPro Card, et de la
 * rareté visuelle qui en découle (bronze / argent / or / icon).
 *
 * OVR = mix reliability_score (comportement + skill perçu) et, si dispo,
 * performance vérifiée EA (buts+passes/match, note moyenne implicite).
 * Volontairement simple et transparent (pas de boîte noire) : c'est un score
 * produit, pas une vérité absolue.
 */

export type Rarity = "bronze" | "silver" | "gold" | "icon";

export interface OvrInputs {
  reliabilityScore: number; // 0-100
  verifiedStats?: {
    goals?: number;
    assists?: number;
    matchesPlayed?: number;
    avgRating?: number; // 0-10 si dispo côté EA
  } | null;
}

export function computeOvr({ reliabilityScore, verifiedStats }: OvrInputs): number {
  // Base : 40% du score de fiabilité ramené sur 100, plancher à 45 pour rester "jouable" visuellement.
  const reliabilityComponent = 45 + reliabilityScore * 0.4; // 45-85

  let performanceComponent = 0;
  if (verifiedStats?.matchesPlayed && verifiedStats.matchesPlayed > 0) {
    const goalsPerMatch = (verifiedStats.goals ?? 0) / verifiedStats.matchesPlayed;
    const assistsPerMatch = (verifiedStats.assists ?? 0) / verifiedStats.matchesPlayed;
    const ratingComponent = verifiedStats.avgRating ? (verifiedStats.avgRating - 6) * 3 : 0;
    performanceComponent = Math.min(15, goalsPerMatch * 8 + assistsPerMatch * 6 + ratingComponent);
  }

  const ovr = reliabilityComponent * 0.7 + (45 + performanceComponent * 2) * 0.3;
  return Math.max(40, Math.min(99, Math.round(ovr)));
}

export function rarityForOvr(ovr: number): Rarity {
  if (ovr >= 90) return "icon";
  if (ovr >= 80) return "gold";
  if (ovr >= 65) return "silver";
  return "bronze";
}

export const RARITY_LABEL: Record<Rarity, string> = {
  bronze: "Bronze",
  silver: "Argent",
  gold: "Or",
  icon: "Icon",
};

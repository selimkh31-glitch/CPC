/**
 * OVR CPC — note produit affichée sur la carte joueur.
 *
 * Source unique : `reliability_score` stocké (Trust Engine : reviews + streak).
 * Jamais de mix avec `verified_stats` EA (buts/passes/note). Un club EA lié
 * n'est pas une identité joueur EA, et ces chiffres ne doivent pas gonfler
 * une note CPC.
 *
 * Pas de plancher décoratif 45 : un joueur sans signal CPC (score 0 / absent)
 * n'a pas d'OVR à afficher. `computeOvr` renvoie `null` dans ce cas — cacher
 * le chiffre plutôt que d'inventer du 45–70.
 *
 * Labelliser uniquement « OVR CPC », jamais un bare « OVR ».
 */

export type Rarity = "bronze" | "silver" | "gold" | "icon";

export interface OvrInputs {
  reliabilityScore: number;
  /**
   * Ignoré volontairement. Conservé dans la signature pour que les anciens
   * appels compilent, et pour que les tests verrouillent : les stats EA
   * ne doivent JAMAIS changer l'OVR CPC.
   */
  verifiedStats?: {
    goals?: number;
    assists?: number;
    matchesPlayed?: number;
    avgRating?: number;
  } | null;
}

/** Signal CPC réel : fiabilité stockée, finie, strictement positive. */
export function canShowOvrCpc(reliabilityScore: unknown): boolean {
  return typeof reliabilityScore === "number" && Number.isFinite(reliabilityScore) && reliabilityScore > 0;
}

/**
 * OVR CPC = arrondi de la fiabilité CPC (1–99), ou `null` si pas de signal.
 * Transparent : pas de boîte noire, pas de mix EA, pas de plancher 45.
 */
export function computeOvr({ reliabilityScore }: OvrInputs): number | null {
  if (!canShowOvrCpc(reliabilityScore)) return null;
  return Math.max(1, Math.min(99, Math.round(reliabilityScore)));
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

/** Libellé unique — jamais « OVR » seul. */
export const OVR_CPC_LABEL = "OVR CPC";

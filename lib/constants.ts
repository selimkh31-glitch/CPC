/**
 * Constantes produit partagées front/back : labels, feature flags, limites freemium.
 */

export const POSITIONS = [
  "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST",
] as const;
export type PositionCode = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<PositionCode, string> = {
  GK: "Gardien",
  CB: "Défenseur central",
  LB: "Latéral gauche",
  RB: "Latéral droit",
  CDM: "Milieu défensif",
  CM: "Milieu central",
  CAM: "Milieu offensif",
  LM: "Milieu gauche",
  RM: "Milieu droit",
  LW: "Ailier gauche",
  RW: "Ailier droit",
  ST: "Attaquant",
};

export const PLATFORMS = ["PS", "XBOX", "PC"] as const;
export type PlatformCode = (typeof PLATFORMS)[number];
export const PLATFORM_LABELS: Record<PlatformCode, string> = {
  PS: "PlayStation",
  XBOX: "Xbox",
  PC: "PC",
};

export const PLAY_STYLES = [
  "ATTACKING", "DEFENSIVE", "BALANCED", "PLAYMAKER", "POACHER", "ENFORCER",
] as const;
export type PlayStyleCode = (typeof PLAY_STYLES)[number];
export const PLAY_STYLE_LABELS: Record<PlayStyleCode, string> = {
  ATTACKING: "Offensif",
  DEFENSIVE: "Défensif",
  BALANCED: "Équilibré",
  PLAYMAKER: "Meneur de jeu",
  POACHER: "Renard des surfaces",
  ENFORCER: "Sentinelle",
};

export const LANGUAGES = ["FR", "EN", "ES", "DE", "PT", "AR", "IT"] as const;
export const LANGUAGE_LABELS: Record<string, string> = {
  FR: "Français",
  EN: "Anglais",
  ES: "Espagnol",
  DE: "Allemand",
  PT: "Portugais",
  AR: "Arabe",
  IT: "Italien",
};

export const CLUB_LEVELS = ["CASUAL", "COMPETITIVE"] as const;
export const CLUB_LEVEL_LABELS: Record<string, string> = {
  CASUAL: "Casual",
  COMPETITIVE: "Compétitif",
};

// --- Feature flags (env, publiques) ---------------------------------------
export const FEATURE_EA_STATS = process.env.EXPO_PUBLIC_FEATURE_EA_STATS !== "false";
export const FEATURE_AI = process.env.EXPO_PUBLIC_FEATURE_AI !== "false";
export const FEATURE_REVENUECAT = process.env.EXPO_PUBLIC_FEATURE_REVENUECAT === "true";

/** Copy courte si l'IAP n'est pas branché — pas de toast de succès fictif. */
export const PRO_PURCHASE_UNAVAILABLE_REASON = "Paiement in-app pas encore configuré.";

export function proPurchaseCta(revenueCatEnabled: boolean): {
  canPurchase: boolean;
  disabledReason: string | null;
} {
  if (revenueCatEnabled) return { canPurchase: true, disabledReason: null };
  return { canPurchase: false, disabledReason: PRO_PURCHASE_UNAVAILABLE_REASON };
}

// --- Freemium ---------------------------------------------------------------
export const FREE_APPLICATIONS_PER_DAY = 3;
export const PRO_PRICE_EUR = 5;

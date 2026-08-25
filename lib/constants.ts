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
/**
 * Prix cible futur (~2€/mois visé, 5 historique). Ne jamais l'afficher tant que
 * FEATURE_REVENUECAT est false — pas de prix fictif à l'écran.
 */
export const PRO_PRICE_EUR = 5;

/** Fonctionnalités citées ailleurs comme « Pro » mais pas livrées — jamais en live. */
export const PRO_LATER_FEATURES = [
  "Scout Report IA",
  "Saison CPC",
  "Badges de saison",
  "Stats EA liées",
  "Carte animée premium + raretés",
  "Filtres avancés",
  "Priorité dans les candidatures",
] as const;

export type PricingScreenCopy = {
  intro: string;
  /** null si RevenueCat off — aucun montant euro à l'écran. */
  priceLabel: string | null;
  ctaLabel: string;
  liveFeatures: string[];
  laterHeading: string;
  laterFeatures: string[];
};

export type ProfileProEntryCopy = {
  title: string;
  subtitle: string | null;
  accessibilityLabel: string;
  looksLikeStore: boolean;
};

/**
 * Copy /pricing. CPC launch = gratuit (liquidité). Fondamentaux sociaux
 * (LIVE, profil, DM, postuler/inviter) non paywallés. Quota matchmaking plus tard.
 */
export function pricingScreenCopy(revenueCatEnabled: boolean): PricingScreenCopy {
  const laterFeatures = [...PRO_LATER_FEATURES];
  if (!revenueCatEnabled) {
    return {
      intro: "CPC est gratuit pour le moment. Pro n'est pas encore en vente.",
      priceLabel: null,
      ctaLabel: "Pro pas encore en vente",
      liveFeatures: [],
      laterHeading: "Plus tard — pas encore dans le produit",
      laterFeatures,
    };
  }
  return {
    intro: "Abonnement Pro via l'App Store ou Play Store, annulable à tout moment.",
    priceLabel: `${PRO_PRICE_EUR}€ / mois`,
    ctaLabel: "Passer Pro",
    liveFeatures: [],
    laterHeading: "Plus tard — pas encore dans le produit",
    laterFeatures,
  };
}

/** Entrée Profil → /pricing : écran joignable, pas un bouton d'achat brillant si IAP off. */
export function profileProEntryCopy(revenueCatEnabled: boolean): ProfileProEntryCopy {
  if (!revenueCatEnabled) {
    return {
      title: "Pro",
      subtitle: "Pas encore en vente",
      accessibilityLabel: "Pro — pas encore en vente",
      looksLikeStore: false,
    };
  }
  return {
    title: "Passer Pro",
    subtitle: null,
    accessibilityLabel: "Passer Pro",
    looksLikeStore: true,
  };
}

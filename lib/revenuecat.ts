import { Platform } from "react-native";
import Purchases, { type CustomerInfo } from "react-native-purchases";
import { FEATURE_REVENUECAT } from "@/lib/constants";

export const PRO_ENTITLEMENT_ID = "pro";

/**
 * Achats in-app mobile (section 6) — abonnement Pro 5€/mois via RevenueCat
 * (au-dessus de StoreKit / Google Play Billing, PAS de Stripe direct sur mobile).
 * Nécessite un dev build EAS (react-native-purchases est un module natif, non
 * disponible dans Expo Go). Voir README > "Brancher RevenueCat".
 */
export function configureRevenueCat(appUserId: string) {
  if (!FEATURE_REVENUECAT) return;

  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

  if (!apiKey || apiKey.endsWith("_placeholder")) {
    console.warn("[revenuecat] Clé API manquante — configure EXPO_PUBLIC_REVENUECAT_*_KEY.");
    return;
  }

  Purchases.configure({ apiKey, appUserID: appUserId });
}

export async function getOfferings() {
  if (!FEATURE_REVENUECAT) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePro(packageIdentifier: string) {
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages.find((p) => p.identifier === packageIdentifier);
  if (!pkg) throw new Error("Offre Pro introuvable.");
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return hasProEntitlement(customerInfo);
}

export async function restorePurchases() {
  const customerInfo = await Purchases.restorePurchases();
  return hasProEntitlement(customerInfo);
}

export function hasProEntitlement(customerInfo: CustomerInfo) {
  return typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== "undefined";
}

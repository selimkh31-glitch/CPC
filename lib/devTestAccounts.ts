/**
 * Identités de test — UNIQUEMENT __DEV__. CoS les sème en DB.
 * L'app ne wipe jamais la base. Mot de passe : EXPO_PUBLIC_CPC_TEST_PASSWORD
 * ou le fallback compilé seulement sous __DEV__ (jamais loggé).
 */

export const CPC_DEV_TEST_ACCOUNT_EMAILS = [
  "test-manager@cpc.dev",
  "test-gardien@cpc.dev",
  "test-defenseur@cpc.dev",
  "test-milieu@cpc.dev",
  "test-attaquant@cpc.dev",
] as const;

export type CpcDevTestEmail = (typeof CPC_DEV_TEST_ACCOUNT_EMAILS)[number];

export const CPC_DEV_TEST_ACCOUNTS: { email: CpcDevTestEmail; label: string }[] =
  typeof __DEV__ !== "undefined" && __DEV__
    ? [
        { email: "test-manager@cpc.dev", label: "Manager" },
        { email: "test-gardien@cpc.dev", label: "Gardien" },
        { email: "test-defenseur@cpc.dev", label: "Défenseur" },
        { email: "test-milieu@cpc.dev", label: "Milieu" },
        { email: "test-attaquant@cpc.dev", label: "Attaquant" },
      ]
    : [];

const DEV_FALLBACK_PASSWORD = typeof __DEV__ !== "undefined" && __DEV__ ? "CpcDevTest1!" : "";

/** Null hors __DEV__ — le fallback ne doit pas servir en prod. */
export function cpcDevTestPassword(): string | null {
  if (typeof __DEV__ === "undefined" || !__DEV__) return null;
  const fromEnv = process.env.EXPO_PUBLIC_CPC_TEST_PASSWORD;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEV_FALLBACK_PASSWORD || null;
}

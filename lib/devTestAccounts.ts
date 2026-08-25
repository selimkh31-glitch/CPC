/**
 * Identités de test — UNIQUEMENT __DEV__. CoS les sème en DB (13 auth users).
 * L'app ne wipe jamais la base. Mot de passe : EXPO_PUBLIC_CPC_TEST_PASSWORD
 * ou le fallback compilé seulement sous __DEV__ (jamais loggé).
 *
 * test-defenseur / test-milieu / test-attaquant n'existent pas.
 */

export const CPC_DEV_TEST_SEED = [
  { email: "test-manager@cpc.dev", label: "Manager", username: "cpc_manager", position: "CM" },
  { email: "test-gardien@cpc.dev", label: "Gardien", username: "cpc_gk", position: "GK" },
  { email: "test-dc@cpc.dev", label: "Défenseur central", username: "cpc_cb", position: "CB" },
  { email: "test-ag@cpc.dev", label: "Arrière gauche", username: "cpc_lb", position: "LB" },
  { email: "test-ad@cpc.dev", label: "Arrière droit", username: "cpc_rb", position: "RB" },
  { email: "test-mdc@cpc.dev", label: "Milieu défensif", username: "cpc_cdm", position: "CDM" },
  { email: "test-mc@cpc.dev", label: "Milieu central", username: "cpc_cm", position: "CM" },
  { email: "test-moc@cpc.dev", label: "Meneur", username: "cpc_cam", position: "CAM" },
  { email: "test-mg@cpc.dev", label: "Ailier gauche", username: "cpc_lm", position: "LM" },
  { email: "test-md@cpc.dev", label: "Ailier droit", username: "cpc_rm", position: "RM" },
  { email: "test-agile@cpc.dev", label: "Ailier gauche off", username: "cpc_lw", position: "LW" },
  { email: "test-ail@cpc.dev", label: "Ailier droit off", username: "cpc_rw", position: "RW" },
  { email: "test-bu@cpc.dev", label: "Buteur", username: "cpc_st", position: "ST" },
] as const;

export const CPC_DEV_TEST_ACCOUNT_EMAILS = CPC_DEV_TEST_SEED.map((a) => a.email);

export type CpcDevTestEmail = (typeof CPC_DEV_TEST_SEED)[number]["email"];

export const CPC_DEV_TEST_ACCOUNTS: {
  email: CpcDevTestEmail;
  label: string;
  username: string;
  position: string;
}[] = typeof __DEV__ !== "undefined" && __DEV__ ? [...CPC_DEV_TEST_SEED] : [];

const DEV_FALLBACK_PASSWORD = typeof __DEV__ !== "undefined" && __DEV__ ? "CpcDevTest1!" : "";

/** Null hors __DEV__ — le fallback ne doit pas servir en prod. */
export function cpcDevTestPassword(): string | null {
  if (typeof __DEV__ === "undefined" || !__DEV__) return null;
  const fromEnv = process.env.EXPO_PUBLIC_CPC_TEST_PASSWORD;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEV_FALLBACK_PASSWORD || null;
}

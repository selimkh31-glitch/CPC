import { supabase } from "@/lib/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { cpcDevTestPassword, type CpcDevTestEmail } from "@/lib/devTestAccounts";

/**
 * Switch compte test. LIVE = row DB + TTL, pas une présence app.
 * Changer de compte n'est pas « Arrêter » : pas d'écriture live, pas de
 * go-offline, pas de déconnexion préalable (unmount du LIVE n'est pas une coupe).
 * `signInWithPassword` remplace la session ; le cache React Query se vide
 * seulement après succès.
 */
export async function switchDevTestAccount(email: CpcDevTestEmail): Promise<void> {
  const password = cpcDevTestPassword();
  if (!password) throw new Error("Comptes test uniquement en __DEV__.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  queryClient.clear();
}

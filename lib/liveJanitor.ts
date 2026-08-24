import { supabase } from "@/lib/supabase/client";

/**
 * Coupe les LIVE périmés en base (et passe leurs candidatures PENDING → EXPIRED).
 * Appelé au fetch discovery. Si 0023 n'est pas encore appliqué / GRANT manquant,
 * on log et on continue : `isLiveActive` reste le juge côté client.
 */
export async function invokeExpireStaleLiveSessions(): Promise<void> {
  const { error } = await supabase.rpc("expire_stale_live_sessions");
  if (error) {
    console.warn("[live] expire_stale_live_sessions:", error.message);
  }
}

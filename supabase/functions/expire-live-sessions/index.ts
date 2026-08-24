import { jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";

/**
 * P0/P1 — cron HTTP : coupe les LIVE club/joueur dont expires_at est dépassé
 * et expire les candidatures PENDING de ces sessions (via RPC SQL).
 * Protégé par CRON_SECRET (même mécanisme que resolve-expired-departures).
 * `verify_jwt = false` dans config.toml : l'appelant n'a pas de JWT session.
 * Alternative sans HTTP : pg_cron SQL `expire-live-sessions-sql` (migration 0023)
 * et invoke client `expire_stale_live_sessions` au fetch du Live Feed.
 */
Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) return jsonResponse({ error: "Non autorisé" }, 401);

  const admin = getAdminClient();
  const { data, error } = await admin.rpc("expire_stale_live_sessions");
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ expired: data ?? 0 });
});

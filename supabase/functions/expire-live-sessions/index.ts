import { jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";

/**
 * P0 — cron : coupe les LIVE club/joueur dont expires_at est dépassé.
 * Protégé par CRON_SECRET (même mécanisme que resolve-expired-departures).
 * Le client filtre aussi expires_at, ce job aligne is_live en base.
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

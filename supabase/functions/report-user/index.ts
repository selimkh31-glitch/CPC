import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { optionalString, requireEnum, requireUuid, ValidationError } from "../_shared/validate.ts";
import { REPORT_REASONS } from "../_shared/safety.ts";

/**
 * Signalement persisté (OPEN) pour la modération. Unique OPEN par paire.
 * Pas un bouton mort : la ligne reste lisible par le reporter (RLS).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let userId: string;
  let reason: (typeof REPORT_REASONS)[number];
  let details: string | undefined;
  try {
    const body = await req.json();
    userId = requireUuid(body.userId, "userId");
    reason = requireEnum(body.reason, "reason", REPORT_REASONS);
    details = optionalString(body.details, "details", { max: 2000 });
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  if (userId === user.id) {
    return jsonResponse({ error: "Impossible de te signaler toi-même." }, 400);
  }

  const admin = getAdminClient();
  const { data: target } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
  if (!target) return jsonResponse({ error: "Joueur introuvable." }, 404);

  const { data: report, error } = await admin
    .from("user_reports")
    .insert({
      reporter_id: user.id,
      reported_id: userId,
      reason,
      details: details ?? null,
      status: "OPEN",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonResponse({ error: "Tu as déjà un signalement ouvert pour ce joueur." }, 409);
    }
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ report });
});

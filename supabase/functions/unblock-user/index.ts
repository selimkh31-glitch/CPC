import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";

/** Retire un blocage posé par l'appelant. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let userId: string;
  try {
    const body = await req.json();
    userId = requireUuid(body.userId, "userId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", userId)
    .select("id");

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!data || data.length === 0) {
    return jsonResponse({ error: "Aucun blocage à retirer." }, 404);
  }

  return jsonResponse({ ok: true });
});

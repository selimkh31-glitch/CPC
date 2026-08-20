import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";

/**
 * Chat, section 11 — ouvre (ou retrouve) la conversation DIRECT entre
 * l'utilisateur appelant et `otherUserId`. Délègue tout le travail atomique
 * (dédoublonnage + insertion des 2 membres) à start_direct_conversation()
 * (SECURITY DEFINER, supabase/migrations/0017_chat_rls.sql) — cette fonction
 * ne fait que valider l'auth/l'entrée et traduire les erreurs métier.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let otherUserId: string;
  try {
    const body = await req.json();
    otherUserId = requireUuid(body.otherUserId, "otherUserId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  if (otherUserId === user.id) {
    return jsonResponse({ error: "Impossible de démarrer une conversation avec toi-même." }, 400);
  }

  const admin = getAdminClient();
  const { data: conversation, error } = await admin.rpc("start_direct_conversation", {
    p_actor_id: user.id,
    p_other_user_id: otherUserId,
  });

  if (error) {
    if (error.message.includes("user_not_found")) return jsonResponse({ error: "Joueur introuvable." }, 404);
    if (error.message.includes("cannot_message_self")) return jsonResponse({ error: "Impossible de démarrer une conversation avec toi-même." }, 400);
    console.error("[start-direct-conversation] échec RPC:", error.message);
    return jsonResponse({ error: "Impossible de démarrer la conversation." }, 500);
  }

  return jsonResponse({ conversation });
});

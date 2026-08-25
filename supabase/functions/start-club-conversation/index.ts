import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";

function mapStartClubConversationError(message: string): { text: string; status: number } {
  if (message.includes("club_not_found")) return { text: "Club introuvable.", status: 404 };
  if (message.includes("not_authorized")) return { text: "Tu n'es pas membre de ce club.", status: 403 };
  if (message.includes("club_conversation_missing")) {
    return { text: "Impossible d'ouvrir la conversation du club.", status: 500 };
  }
  return { text: "Impossible d'ouvrir la conversation du club.", status: 500 };
}

/**
 * Chat club — ouvre (ou retrouve) la conversation CLUB du club, une par club
 * (index unique 0016). Délègue à start_club_conversation() (0028).
 * OWNER / MANAGER / MEMBER. Réutilise /conversation/[id]. Pas de 2e moteur.
 * Block : n'interdit pas le fil club (messages_reject_if_blocked skip
 * non-DIRECT, 0025). MESSAGE_RECEIVED déjà skip GROUP/CLUB.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let clubId: string;
  try {
    const body = await req.json();
    clubId = requireUuid(body.clubId, "clubId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();
  const { data: conversation, error } = await admin.rpc("start_club_conversation", {
    p_actor_id: user.id,
    p_club_id: clubId,
  });

  if (error) {
    const { text, status } = mapStartClubConversationError(error.message);
    if (status >= 500) console.error("[start-club-conversation] échec RPC:", error.message);
    return jsonResponse({ error: text }, status);
  }

  return jsonResponse({ conversation });
});

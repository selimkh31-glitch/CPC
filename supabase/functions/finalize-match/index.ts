import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireIntInRange, requireUuid, ValidationError } from "../_shared/validate.ts";

function mapFinalizeError(message: string): { text: string; status: number } {
  if (message.includes("checkin_not_found")) return { text: "Match introuvable.", status: 404 };
  if (message.includes("not_authorized")) return { text: "Non autorisé.", status: 403 };
  if (message.includes("invalid_score")) return { text: "Score invalide.", status: 400 };
  if (message.includes("already_finalized")) return { text: "Ce match a déjà un résultat enregistré.", status: 409 };
  if (message.includes("mvp_not_present")) return { text: "Le MVP doit avoir été présent à ce match.", status: 400 };
  return { text: message, status: 500 };
}

/**
 * Match Result Engine, Phase A — l'owner/manager finalise le résultat d'un
 * match déjà check-in (score + MVP optionnel). `outcome` n'est jamais reçu du
 * client : calculé côté serveur dans finalize_match()
 * (0014_match_results.sql). Backend only — aucune UI ne consomme encore
 * cette fonction à ce stade (Phase B).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let matchCheckinId: string;
  let ourScore: number;
  let opponentScore: number;
  let mvpUserId: string | null;
  try {
    const body = await req.json();
    matchCheckinId = requireUuid(body.matchCheckinId, "matchCheckinId");
    ourScore = requireIntInRange(body.ourScore, "ourScore", 0, 99);
    opponentScore = requireIntInRange(body.opponentScore, "opponentScore", 0, 99);
    mvpUserId = body.mvpUserId === undefined || body.mvpUserId === null ? null : requireUuid(body.mvpUserId, "mvpUserId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: result, error } = await admin.rpc("finalize_match", {
    p_match_checkin_id: matchCheckinId,
    p_actor_id: user.id,
    p_our_score: ourScore,
    p_opponent_score: opponentScore,
    p_mvp_user_id: mvpUserId,
  });

  if (error) {
    const { text, status } = mapFinalizeError(error.message);
    return jsonResponse({ error: text }, status);
  }

  return jsonResponse({ matchResult: result });
});

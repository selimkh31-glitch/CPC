import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { optionalUuid, requireIntInRange, requireUuid, ValidationError } from "../_shared/validate.ts";

function mapFinalizeError(message: string): { text: string; status: number } {
  if (message.includes("checkin_not_found")) return { text: "Match introuvable.", status: 404 };
  if (message.includes("not_authorized")) return { text: "Non autorisé.", status: 403 };
  if (message.includes("invalid_score")) return { text: "Score invalide.", status: 400 };
  if (message.includes("already_finalized")) return { text: "Ce match a déjà un résultat enregistré.", status: 409 };
  if (message.includes("mvp_not_present")) return { text: "Le MVP doit avoir été présent à ce match.", status: 400 };
  if (message.includes("opponent_is_self")) return { text: "Le club adverse doit être distinct du tien.", status: 400 };
  if (message.includes("opponent_not_found")) return { text: "Club adverse introuvable.", status: 404 };
  if (message.includes("competition_requires_opponent")) {
    return { text: "Une compétition ne peut être liée que si un club adverse est choisi.", status: 400 };
  }
  if (message.includes("competition_not_found")) return { text: "Compétition introuvable.", status: 404 };
  if (message.includes("competition_not_open")) return { text: "On ne peut lier qu'une compétition ouverte.", status: 400 };
  if (message.includes("clubs_not_in_competition")) {
    return { text: "Les deux clubs doivent être inscrits à cette compétition.", status: 400 };
  }
  return { text: message, status: 500 };
}

/**
 * Match Result Engine — l'owner/manager finalise le résultat d'un match
 * déjà check-in (score + MVP optionnel + club adverse CPC optionnel +
 * compétition optionnelle). `outcome` n'est jamais reçu du client : calculé
 * côté serveur dans finalize_match() (0014 + 0027).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let matchCheckinId: string;
  let ourScore: number;
  let opponentScore: number;
  let mvpUserId: string | null;
  let opponentClubId: string | null;
  let competitionId: string | null;
  try {
    const body = await req.json();
    matchCheckinId = requireUuid(body.matchCheckinId, "matchCheckinId");
    ourScore = requireIntInRange(body.ourScore, "ourScore", 0, 99);
    opponentScore = requireIntInRange(body.opponentScore, "opponentScore", 0, 99);
    mvpUserId = body.mvpUserId === undefined || body.mvpUserId === null ? null : requireUuid(body.mvpUserId, "mvpUserId");
    opponentClubId = optionalUuid(body.opponentClubId, "opponentClubId");
    competitionId = optionalUuid(body.competitionId, "competitionId");
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
    p_opponent_club_id: opponentClubId,
    p_competition_id: competitionId,
  });

  if (error) {
    const { text, status } = mapFinalizeError(error.message);
    return jsonResponse({ error: text }, status);
  }

  return jsonResponse({ matchResult: result });
});

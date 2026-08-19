import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { sendPushNotification } from "../_shared/push.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";

function mapReleaseError(message: string): { text: string; status: number } {
  if (message.includes("not_authorized")) return { text: "Non autorisé.", status: 403 };
  if (message.includes("member_not_found")) return { text: "Ce joueur n'est pas membre de ce club.", status: 404 };
  if (message.includes("cannot_release_owner")) return { text: "Impossible de libérer le owner d'un club.", status: 403 };
  return { text: message, status: 500 };
}

/**
 * Libération d'un joueur à l'initiative de l'owner/manager (Phase 5, section
 * H) — jamais silencieuse : le joueur est TOUJOURS notifié, l'événement est
 * TOUJOURS historisé (club_departures, status OWNER_RELEASED). Atomique via
 * release_member_by_manager() (0012_engagement_functions.sql).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let clubId: string;
  let targetUserId: string;
  try {
    const body = await req.json();
    clubId = requireUuid(body.clubId, "clubId");
    targetUserId = requireUuid(body.userId, "userId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: departure, error } = await admin.rpc("release_member_by_manager", {
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_actor_id: user.id,
  });

  if (error) {
    const { text, status } = mapReleaseError(error.message);
    return jsonResponse({ error: text }, status);
  }

  const { data: club } = await admin.from("clubs").select("name").eq("id", clubId).maybeSingle();
  const { data: player } = await admin.from("users").select("push_token").eq("id", targetUserId).maybeSingle();
  await sendPushNotification(
    player?.push_token,
    "Tu as été libéré de ton club",
    `${club?.name ?? "Le club"} t'a retiré de son effectif. Tu es libre de rejoindre un autre club.`,
    { type: "owner_release", clubId }
  );

  return jsonResponse({ departure });
});

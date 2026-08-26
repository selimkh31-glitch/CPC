import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { sendPushNotification } from "../_shared/push.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";

/** Traduit une exception nommée levée par request_departure() en message utilisateur + status HTTP. */
function mapDepartureError(message: string): { text: string; status: number } {
  if (message.includes("not_a_member")) return { text: "Tu n'es pas membre de ce club.", status: 404 };
  if (message.includes("owner_cannot_request_departure"))
    return { text: "Un owner ne peut pas utiliser ce workflow — la succession de club est hors périmètre.", status: 403 };
  if (message.includes("no_match_played"))
    return { text: "Tu dois avoir joué au moins 1 match validé (check-in) dans ce club avant de pouvoir demander ton départ.", status: 403 };
  if (message.includes("departure_already_active"))
    return { text: "Tu as déjà une demande de départ en cours pour ce club.", status: 409 };
  return { text: message, status: 500 };
}

/**
 * Demande de départ — éligibilité SERVEUR dans request_departure().
 * 0 match : ACCEPTED_NOW + release immédiat, pas de push « 3 minutes ».
 * 1+ match : PENDING 3 min, push owner/manager inchangé.
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

  const { data: departure, error } = await admin.rpc("request_departure", {
    p_club_id: clubId,
    p_user_id: user.id,
  });

  if (error) {
    const { text, status } = mapDepartureError(error.message);
    return jsonResponse({ error: text }, status);
  }

  const leftImmediately = (departure as { status?: string } | null)?.status === "ACCEPTED_NOW";

  if (!leftImmediately) {
    const { data: player } = await admin.from("users").select("username").eq("id", user.id).maybeSingle();
    const { data: managers } = await admin
      .from("club_members")
      .select("user:users(push_token)")
      .eq("club_id", clubId)
      .in("role", ["OWNER", "MANAGER"]);
    for (const m of managers ?? []) {
      await sendPushNotification(
        (m as any).user?.push_token,
        "Nouvelle demande de départ 🚪",
        `${player?.username ?? "Un joueur"} souhaite quitter le club — réponds sous 3 minutes.`,
        { type: "departure_request", clubId }
      );
    }
  }

  return jsonResponse({ departure, leftImmediately });
});

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { sendPushNotification } from "../_shared/push.ts";
import { requireEnum, requireUuid, ValidationError } from "../_shared/validate.ts";

function mapDepartureError(message: string): { text: string; status: number } {
  if (message.includes("departure_not_found")) return { text: "Demande de départ introuvable.", status: 404 };
  if (message.includes("not_authorized")) return { text: "Non autorisé.", status: 403 };
  if (message.includes("departure_not_pending")) return { text: "Cette demande a déjà été traitée.", status: 409 };
  if (message.includes("departure_expired")) return { text: "Cette demande a expiré.", status: 409 };
  if (message.includes("invalid_decision")) return { text: "Décision invalide.", status: 400 };
  return { text: message, status: 500 };
}

/**
 * Réponse owner/manager à une demande de départ (Phase 5, section B) — 3
 * choix. NOW/NEXT_MATCH/REFUSE gérés atomiquement par respond_departure()
 * (0012_engagement_functions.sql), qui délègue REFUSE au compteur de strikes
 * unifié (apply_departure_strike, partagé avec le sweep cron
 * resolve-expired-departures) — 3ᵉ strike -> FORCE_EXIT automatique.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let departureId: string;
  let decision: "NOW" | "NEXT_MATCH" | "REFUSE";
  try {
    const body = await req.json();
    departureId = requireUuid(body.departureId, "departureId");
    decision = requireEnum(body.decision, "decision", ["NOW", "NEXT_MATCH", "REFUSE"] as const);
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: departure, error } = await admin.rpc("respond_departure", {
    p_departure_id: departureId,
    p_actor_id: user.id,
    p_decision: decision,
  });

  if (error) {
    const { text, status } = mapDepartureError(error.message);
    return jsonResponse({ error: text }, status);
  }

  // Notifie le joueur — non-bloquant. Le statut final (incluant un éventuel
  // FORCE_EXIT déclenché par un 3e refus) est déjà résolu dans `departure`.
  const { data: player } = await admin.from("users").select("push_token").eq("id", departure.user_id).maybeSingle();
  const titles: Record<string, [string, string]> = {
    ACCEPTED_NOW: ["Départ accepté ✅", "Tu es libre de rejoindre un nouveau club."],
    ACCEPTED_NEXT_MATCH: ["Départ programmé 🗓️", "Tu joues normalement le prochain match, puis tu seras libre."],
    REFUSED: ["Demande refusée", "Ta demande de départ a été refusée. Tu peux refaire une demande à tout moment."],
    FORCE_EXIT: ["Départ forcé 🔓", "3 refus/non-réponses cumulés : tu es automatiquement libéré."],
  };
  const [title, body] = titles[departure.status] ?? ["Réponse à ta demande de départ", "Ta demande a été traitée."];
  await sendPushNotification(player?.push_token, title, body, { type: "departure_response", status: departure.status });

  return jsonResponse({ departure });
});

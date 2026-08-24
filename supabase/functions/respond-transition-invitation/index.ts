import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireEnum, requireUuid, ValidationError } from "../_shared/validate.ts";
import { notifyUser } from "../_shared/notify.ts";

function mapTransitionError(message: string): { text: string; status: number } {
  if (message.includes("invitation_not_found")) return { text: "Invitation introuvable.", status: 404 };
  if (message.includes("not_authorized")) return { text: "Non autorisé.", status: 403 };
  if (message.includes("invitation_not_pending")) return { text: "Cette invitation a déjà été traitée.", status: 409 };
  if (message.includes("not_a_transition_invitation")) return { text: "Cette invitation n'est pas une offre de transition.", status: 400 };
  if (message.includes("departure_not_transitionable"))
    return { text: "Ton départ n'est plus programmé après le prochain match — cette offre n'est plus valide.", status: 409 };
  return { text: message, status: 500 };
}

/**
 * Réponse du joueur à une invitation de TRANSITION (Phase 5, section D/19) —
 * une invitation portant `departure_request_id`, reçue pendant un statut
 * ACCEPTED_NEXT_MATCH chez le club actuel (voir invite-to-slot, modifié pour
 * poser ce lien). Refuser une invitation de transition suit exactement le
 * même chemin qu'un refus d'invitation normale (RLS invitations_decline_self,
 * déjà en place) — seule l'ACCEPTATION diffère : PENDING -> RESERVED (jamais
 * ACCEPTED directement), via accept_transition_invitation()
 * (0012_engagement_functions.sql). Le joueur n'intègre club_members/
 * slot_assignments du nouveau club qu'à la finalisation par
 * launch_match_checkin, au match libérateur chez l'ancien club.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let invitationId: string;
  let status: "ACCEPTED" | "DECLINED";
  try {
    const body = await req.json();
    invitationId = requireUuid(body.invitationId, "invitationId");
    status = requireEnum(body.status, "status", ["ACCEPTED", "DECLINED"] as const);
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: existing } = await admin.from("invitations").select("*").eq("id", invitationId).maybeSingle();
  if (!existing) return jsonResponse({ error: "Invitation introuvable." }, 404);
  if (existing.user_id !== user.id) return jsonResponse({ error: "Non autorisé" }, 403);

  let updated = existing;

  if (status === "DECLINED") {
    const { data: declined, error } = await admin
      .from("invitations")
      .update({ status: "DECLINED" })
      .eq("id", invitationId)
      .eq("user_id", user.id)
      .eq("status", "PENDING")
      .select()
      .single();
    if (error) return jsonResponse({ error: "Cette invitation a déjà été traitée." }, 409);
    updated = declined;
  } else {
    const { data: invitation, error } = await admin.rpc("accept_transition_invitation", {
      p_invitation_id: invitationId,
      p_actor_id: user.id,
    });

    if (error) {
      const { text, status: httpStatus } = mapTransitionError(error.message);
      return jsonResponse({ error: text }, httpStatus);
    }
    updated = invitation;
  }

  const { data: inviter } = await admin
    .from("users")
    .select("id, push_token")
    .eq("id", existing.invited_by)
    .maybeSingle();
  const { data: club } = await admin.from("clubs").select("name").eq("id", existing.club_id).maybeSingle();
  const { data: player } = await admin.from("users").select("username").eq("id", user.id).maybeSingle();
  await notifyUser(admin, {
    userId: existing.invited_by,
    type: status === "ACCEPTED" ? "INVITATION_ACCEPTED" : "INVITATION_DECLINED",
    title: status === "ACCEPTED" ? "Invitation acceptée" : "Invitation refusée",
    body:
      status === "ACCEPTED"
        ? `${player?.username ?? "Un joueur"} a accepté l'invitation${club?.name ? ` pour ${club.name}` : ""} (transition).`
        : `${player?.username ?? "Un joueur"} a refusé l'invitation${club?.name ? ` pour ${club.name}` : ""}.`,
    data: { clubId: existing.club_id, invitationId, status },
    pushToken: inviter?.push_token,
  });

  return jsonResponse({ invitation: updated });
});

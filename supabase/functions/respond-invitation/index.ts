import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireEnum, requireUuid, ValidationError } from "../_shared/validate.ts";
import { nextInvitationStatus, type InvitationStatus } from "../_shared/recruitment.ts";

/** Le joueur invité accepte/refuse (phase 4) — même structure que respond-application. */
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

  const { data: invitation } = await admin.from("invitations").select("*").eq("id", invitationId).single();
  if (!invitation) return jsonResponse({ error: "Invitation introuvable" }, 404);

  if (invitation.user_id !== user.id) {
    return jsonResponse({ error: "Non autorisé" }, 403);
  }

  const event = status === "ACCEPTED" ? "ACCEPT" : "DECLINE";
  const next = nextInvitationStatus(invitation.status as InvitationStatus, event);
  if (!next) {
    return jsonResponse({ error: "Cette invitation a déjà été traitée." }, 409);
  }

  let updated: typeof invitation;

  if (status === "ACCEPTED") {
    // Acceptation atomique — voir supabase/migrations/0007_match_sheet_rls.sql
    // > accept_invitation() : verrouillage + assignation de slot + club_member.
    const { data: accepted, error: acceptError } = await admin.rpc("accept_invitation", {
      p_invitation_id: invitationId,
      p_actor_id: user.id,
    });
    if (acceptError) {
      const message = acceptError.message.includes("slot_unavailable")
        ? "Ce poste vient d'être pris."
        : acceptError.message.includes("invitation_not_pending")
          ? "Cette invitation a déjà été traitée."
          : acceptError.message;
      return jsonResponse({ error: message }, 409);
    }
    updated = accepted;
  } else {
    const { data: declined, error } = await admin
      .from("invitations")
      .update({ status })
      .eq("id", invitationId)
      .eq("status", "PENDING")
      .select()
      .single();
    if (error) return jsonResponse({ error: "Cette invitation a déjà été traitée." }, 409);
    updated = declined;
  }

  return jsonResponse({ invitation: updated });
});

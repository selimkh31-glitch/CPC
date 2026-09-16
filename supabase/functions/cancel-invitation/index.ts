import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";
import { nextInvitationStatus, type InvitationStatus } from "../_shared/recruitment.ts";
import { notifyUser } from "../_shared/notify.ts";

/** Owner/manager annule une invitation PENDING — même auth que respond-application. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let invitationId: string;
  try {
    const body = await req.json();
    invitationId = requireUuid(body.invitationId, "invitationId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: invitation } = await admin.from("invitations").select("*").eq("id", invitationId).single();
  if (!invitation) return jsonResponse({ error: "Invitation introuvable" }, 404);

  const { data: membership } = await admin
    .from("club_members")
    .select("role")
    .eq("club_id", invitation.club_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["OWNER", "MANAGER"].includes(membership.role)) {
    return jsonResponse({ error: "Non autorisé" }, 403);
  }

  const next = nextInvitationStatus(invitation.status as InvitationStatus, "CANCEL");
  if (!next) {
    return jsonResponse({ error: "Cette invitation a déjà été traitée." }, 409);
  }

  const { data: updated, error } = await admin
    .from("invitations")
    .update({ status: next })
    .eq("id", invitationId)
    .eq("status", "PENDING")
    .select()
    .single();
  if (error) return jsonResponse({ error: "Cette invitation a déjà été traitée." }, 409);

  const { data: invited } = await admin
    .from("users")
    .select("id, push_token")
    .eq("id", invitation.user_id)
    .maybeSingle();
  const { data: club } = await admin.from("clubs").select("name").eq("id", invitation.club_id).maybeSingle();
  await notifyUser(admin, {
    userId: invitation.user_id,
    type: "INVITATION_CANCELLED",
    title: "Invitation annulée",
    body: club?.name ? `${club.name} a annulé son invitation.` : "Le club a annulé son invitation.",
    data: { clubId: invitation.club_id, invitationId: invitation.id, status: next },
    pushToken: invited?.push_token,
  });

  return jsonResponse({ invitation: updated });
});

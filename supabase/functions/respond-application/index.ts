import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireEnum, requireUuid, ValidationError } from "../_shared/validate.ts";
import { nextApplicationStatus, type ApplicationStatus } from "../_shared/recruitment.ts";
import { notifyUser } from "../_shared/notify.ts";

/** Accepter/refuser une candidature instantanément (section 3.D) — owner/manager only. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let applicationId: string;
  let status: "ACCEPTED" | "DECLINED";
  try {
    const body = await req.json();
    applicationId = requireUuid(body.applicationId, "applicationId");
    const raw = requireEnum(body.status, "status", ["ACCEPTED", "DECLINED", "REJECTED"] as const);
    status = raw === "REJECTED" ? "DECLINED" : raw;
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: application } = await admin.from("applications").select("*").eq("id", applicationId).single();
  if (!application) return jsonResponse({ error: "Candidature introuvable" }, 404);

  const { data: membership } = await admin
    .from("club_members")
    .select("role")
    .eq("club_id", application.club_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["OWNER", "MANAGER"].includes(membership.role)) {
    return jsonResponse({ error: "Non autorisé" }, 403);
  }

  const event = status === "ACCEPTED" ? "ACCEPT" : "DECLINE";
  const next = nextApplicationStatus(application.status as ApplicationStatus, event);
  if (!next) {
    return jsonResponse({ error: "Cette candidature a déjà été traitée." }, 409);
  }

  let updated: typeof application;

  if (status === "ACCEPTED") {
    // Acceptation atomique (verrouillage candidature + session côté DB) :
    // anti-surbooking et anti-double-acceptation concurrente, voir
    // supabase/migrations/0005_live_workflow.sql > accept_application().
    // Ajoute aussi le membre au club (upsert interne à la fonction).
    const { data: accepted, error: acceptError } = await admin.rpc("accept_application", {
      p_application_id: applicationId,
      p_actor_id: user.id,
    });
    if (acceptError) {
      const message =
        acceptError.message.includes("position_unavailable")
          ? "Ce poste vient d'être pourvu par un autre candidat."
          : acceptError.message.includes("application_not_pending")
            ? "Cette candidature a déjà été traitée."
            : acceptError.message.includes("already_has_active_club")
              ? "Ce joueur est déjà engagé avec un autre club."
              : acceptError.message;
      return jsonResponse({ error: message }, 409);
    }
    updated = accepted;
  } else {
    const { data: rejected, error } = await admin
      .from("applications")
      .update({ status: next })
      .eq("id", applicationId)
      .eq("status", "PENDING")
      .select()
      .single();
    if (error) return jsonResponse({ error: "Cette candidature a déjà été traitée." }, 409);
    updated = rejected;
  }

  const { data: applicant } = await admin
    .from("users")
    .select("id, push_token")
    .eq("id", application.user_id)
    .maybeSingle();
  await notifyUser(admin, {
    userId: application.user_id,
    type: status === "ACCEPTED" ? "APPLICATION_ACCEPTED" : "APPLICATION_DECLINED",
    title: status === "ACCEPTED" ? "Candidature acceptée" : "Candidature refusée",
    body:
      status === "ACCEPTED"
        ? "Tu as été accepté dans le club Pro Clubs."
        : "Ta candidature n'a pas été retenue cette fois.",
    data: { clubId: application.club_id, applicationId: application.id, status },
    pushToken: applicant?.push_token,
  });

  return jsonResponse({ application: updated });
});

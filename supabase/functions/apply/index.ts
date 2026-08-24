import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { moderateText } from "../_shared/ai.ts";
import { optionalString, requireString, requireUuid, ValidationError } from "../_shared/validate.ts";
import { canApplyToLiveClub } from "../_shared/liveMatch.ts";
import { rejectIfBlocked } from "../_shared/blocked.ts";
import { notifyUser } from "../_shared/notify.ts";

const FREE_APPLICATIONS_PER_DAY = 3;

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

/** Candidature en 1 clic (section 3.D) — gating freemium 3/jour pour le plan free. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let sessionId: string;
  let position: string;
  let slotId: string | undefined;
  let message: string | undefined;
  try {
    const body = await req.json();
    sessionId = requireUuid(body.sessionId, "sessionId");
    position = requireString(body.position, "position", { min: 1, max: 10 });
    slotId = optionalString(body.slotId, "slotId", { max: 20 });
    message = optionalString(body.message, "message", { max: 280 });
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: profile } = await admin.from("users").select("*").eq("id", user.id).single();
  if (!profile) return jsonResponse({ error: "Profil introuvable, termine l'onboarding." }, 404);

  const { data: session } = await admin
    .from("club_sessions")
    .select("*, club:clubs(id, owner_id, owner:users(platform))")
    .eq("id", sessionId)
    .single();
  if (!session || !session.is_live) {
    return jsonResponse({ error: "Cette session n'est plus disponible." }, 410);
  }

  const ownerId = (session as any).club?.owner_id as string | undefined;
  if (ownerId) {
    const blocked = await rejectIfBlocked(admin, user.id, ownerId);
    if (blocked) return blocked;
  }

  const eligibility = canApplyToLiveClub(
    {
      mainPosition: profile.main_position,
      secondaryPositions: profile.secondary_positions ?? [],
      platform: profile.platform,
    },
    {
      clubId: session.club_id,
      sessionId: session.id,
      neededPositions: session.needed_positions ?? [],
      platform: (session as any).club?.owner?.platform ?? null,
      is_live: Boolean(session.is_live),
      expires_at: session.expires_at ?? null,
    },
    position,
    Date.now()
  );
  if (!eligibility.ok) {
    const expired = eligibility.error.includes("expiré") || eligibility.error.includes("LIVE club");
    return jsonResponse({ error: eligibility.error }, expired ? 410 : 400);
  }

  // Candidature sur un slot précis (phase 4, feuille de match) — vérification
  // best-effort ici (évite une candidature évidemment vouée à l'échec) ; la
  // vraie garantie anti-double-attribution reste accept_application() côté DB
  // (verrouillage + contrainte unique), pas cette Edge Function.
  if (slotId) {
    const { data: existingSlot } = await admin
      .from("slot_assignments")
      .select("id")
      .eq("club_id", session.club_id)
      .eq("slot_id", slotId)
      .maybeSingle();
    if (existingSlot) {
      return jsonResponse({ error: "Ce poste vient d'être pris." }, 409);
    }
  }

  // Anti-auto-candidature — vérifié côté serveur, pas seulement dans l'UI
  // (app/club/[id].tsx masque déjà le formulaire pour les membres existants,
  // ce qui couvre l'owner puisqu'il est membre via le trigger on_club_created).
  const { data: existingMembership } = await admin
    .from("club_members")
    .select("id")
    .eq("club_id", session.club_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingMembership) {
    return jsonResponse({ error: "Tu es déjà membre de ce club." }, 409);
  }

  if (profile.plan === "FREE") {
    const resetNeeded = !isSameDay(new Date(profile.applications_reset_at), new Date());
    const count = resetNeeded ? 0 : profile.applications_today;
    if (count >= FREE_APPLICATIONS_PER_DAY) {
      return jsonResponse(
        { error: `Limite Free atteinte (${FREE_APPLICATIONS_PER_DAY}/jour). Passe Pro pour candidater sans limite.` },
        402
      );
    }
  }

  if (message) {
    const moderation = await moderateText(message);
    if (moderation.toxic) return jsonResponse({ error: "Message refusé par la modération." }, 422);
  }

  const { data: existing } = await admin
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .eq("status", "PENDING")
    .maybeSingle();
  if (existing) return jsonResponse({ error: "Tu as déjà postulé à cette session." }, 409);

  const { data: application, error } = await admin
    .from("applications")
    .insert({
      user_id: user.id,
      club_id: session.club_id,
      session_id: sessionId,
      position,
      slot_id: slotId ?? null,
      message: message || null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique applications_one_pending_per_user_session (course concurrente).
    if (error.code === "23505") return jsonResponse({ error: "Tu as déjà postulé à cette session." }, 409);
    const msg = error.message ?? "";
    if (msg.includes("session_not_live")) return jsonResponse({ error: "Cette session LIVE a expiré." }, 410);
    if (msg.includes("platform_mismatch") || msg.includes("platform_unknown")) {
      return jsonResponse({ error: "Plateforme différente de celle du club." }, 400);
    }
    if (msg.includes("position_not_played") || msg.includes("position_not_needed") || msg.includes("session_no_need")) {
      return jsonResponse({ error: "Ce poste n'est pas compatible avec cette session." }, 400);
    }
    if (msg.includes("users_blocked")) {
      return jsonResponse({ error: "Tu ne peux pas interagir avec ce joueur." }, 403);
    }
    return jsonResponse({ error: error.message }, 500);
  }

  // Quota Free : incrémenté SEULEMENT après insert réussi (un 409/500 ne
  // brûle plus une candidature du jour).
  if (profile.plan === "FREE") {
    const resetNeeded = !isSameDay(new Date(profile.applications_reset_at), new Date());
    const count = resetNeeded ? 0 : profile.applications_today;
    await admin
      .from("users")
      .update({
        applications_today: resetNeeded ? 1 : count + 1,
        applications_reset_at: resetNeeded ? new Date().toISOString() : profile.applications_reset_at,
      })
      .eq("id", user.id);
  }

  const { data: managers } = await admin
    .from("club_members")
    .select("user_id, user:users(id, push_token)")
    .eq("club_id", session.club_id)
    .in("role", ["OWNER", "MANAGER"]);
  for (const m of managers ?? []) {
    const managerId = (m as any).user_id ?? (m as any).user?.id;
    if (!managerId) continue;
    await notifyUser(admin, {
      userId: managerId,
      type: "APPLICATION_RECEIVED",
      title: "Nouvelle candidature",
      body: `${profile.username} veut rejoindre ta session LIVE.`,
      data: { clubId: session.club_id, applicationId: application.id },
      pushToken: (m as any).user?.push_token,
    });
  }

  return jsonResponse({ application });
});

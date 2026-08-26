import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";
import { rejectIfBlocked } from "../_shared/blocked.ts";
import { notifyUser } from "../_shared/notify.ts";

/**
 * Rejoindre un club LIVE = devenir MEMBER (FIFA-like), sans slot.
 * L'attribution d'un poste est un acte ultérieur (claim-slot / invite-to-slot).
 *
 * Garde already_has_active_club : un seul rôle MEMBER/MANAGER actif
 * (index club_members_one_active_role_per_user, 0010 / accept_invitation).
 */
function isLiveNow(session: { is_live: boolean; expires_at: string | null }, nowMs: number): boolean {
  if (!session.is_live || !session.expires_at) return false;
  const t = new Date(session.expires_at).getTime();
  return Number.isFinite(t) && t > nowMs;
}

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

  const { data: club } = await admin.from("clubs").select("id, name, owner_id").eq("id", clubId).maybeSingle();
  if (!club) return jsonResponse({ error: "Club introuvable." }, 404);

  const { data: sessions } = await admin
    .from("club_sessions")
    .select("id, is_live, expires_at")
    .eq("club_id", clubId)
    .eq("is_live", true);
  const live = (sessions ?? []).find((row) => isLiveNow(row, Date.now()));
  if (!live) {
    return jsonResponse({ error: "Cette session n'est plus disponible." }, 410);
  }

  if (club.owner_id) {
    const blocked = await rejectIfBlocked(admin, user.id, club.owner_id);
    if (blocked) return blocked;
  }

  const { data: existingMembership } = await admin
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingMembership) {
    return jsonResponse({ ok: true, alreadyMember: true, clubId });
  }

  const { data: otherActive } = await admin
    .from("club_members")
    .select("club_id")
    .eq("user_id", user.id)
    .in("role", ["MEMBER", "MANAGER"])
    .neq("club_id", clubId)
    .maybeSingle();
  if (otherActive) {
    return jsonResponse({ error: "Tu es déjà engagé avec un autre club." }, 409);
  }

  const { error } = await admin.from("club_members").insert({
    club_id: clubId,
    user_id: user.id,
    role: "MEMBER",
  });

  if (error) {
    if (error.code === "23505" || error.message.includes("club_members_one_active_role_per_user")) {
      const { data: raced } = await admin
        .from("club_members")
        .select("id")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (raced) return jsonResponse({ ok: true, alreadyMember: true, clubId });
      return jsonResponse({ error: "Tu es déjà engagé avec un autre club." }, 409);
    }
    if (error.message.includes("users_blocked")) {
      return jsonResponse({ error: "Tu ne peux pas interagir avec ce joueur." }, 403);
    }
    return jsonResponse({ error: error.message }, 500);
  }

  const { data: profile } = await admin.from("users").select("username").eq("id", user.id).maybeSingle();
  const { data: owner } = club.owner_id
    ? await admin.from("users").select("id, push_token").eq("id", club.owner_id).maybeSingle()
    : { data: null };
  if (owner?.id) {
    const username = (profile as { username?: string } | null)?.username?.trim() || "Un joueur";
    await notifyUser(admin, {
      userId: owner.id,
      type: "MEMBER_JOINED",
      title: "Nouveau membre",
      body: `${username} a rejoint ${club.name}.`,
      data: { clubId },
      pushToken: (owner as { push_token?: string | null }).push_token,
    });
  }

  return jsonResponse({ ok: true, alreadyMember: false, clubId });
});

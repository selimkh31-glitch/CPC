import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";

/**
 * Bloque un joueur Pro Clubs. INSERT service_role (pas d'INSERT client).
 * Annule les invitations / candidatures PENDING entre la paire.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let userId: string;
  try {
    const body = await req.json();
    userId = requireUuid(body.userId, "userId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  if (userId === user.id) {
    return jsonResponse({ error: "Impossible de te bloquer toi-même." }, 400);
  }

  const admin = getAdminClient();

  const { data: target } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
  if (!target) return jsonResponse({ error: "Joueur introuvable." }, 404);

  const { data: block, error } = await admin
    .from("user_blocks")
    .insert({ blocker_id: user.id, blocked_id: userId })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return jsonResponse({ error: "Ce joueur est déjà bloqué." }, 409);
    return jsonResponse({ error: error.message }, 500);
  }

  const pairOr = `and(user_id.eq.${user.id},invited_by.eq.${userId}),and(user_id.eq.${userId},invited_by.eq.${user.id})`;
  await admin.from("invitations").update({ status: "CANCELLED" }).eq("status", "PENDING").or(pairOr);

  const { data: owned } = await admin.from("clubs").select("id, owner_id").in("owner_id", [user.id, userId]);
  for (const club of owned ?? []) {
    const other = club.owner_id === user.id ? userId : user.id;
    await admin
      .from("invitations")
      .update({ status: "CANCELLED" })
      .eq("status", "PENDING")
      .eq("club_id", club.id)
      .eq("user_id", other);
    await admin
      .from("applications")
      .update({ status: "CANCELLED" })
      .eq("status", "PENDING")
      .eq("club_id", club.id)
      .eq("user_id", other);
  }

  return jsonResponse({ block });
});

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireEnum, requireUuid, ValidationError } from "../_shared/validate.ts";

function mapRoleError(message: string): { text: string; status: number } {
  if (message.includes("group_not_found")) return { text: "Groupe introuvable.", status: 404 };
  if (message.includes("not_authorized")) return { text: "Seul le propriétaire du groupe peut changer les rôles.", status: 403 };
  if (message.includes("cannot_change_owner_role")) return { text: "Impossible de modifier le rôle du propriétaire.", status: 400 };
  if (message.includes("cannot_grant_owner_role")) return { text: "Impossible d'attribuer le rôle propriétaire.", status: 400 };
  if (message.includes("member_not_found")) return { text: "Ce membre ne fait pas partie du groupe.", status: 404 };
  return { text: message, status: 500 };
}

/**
 * Groupes sociaux, mission section 12 — seul point d'entrée client pour
 * promouvoir/rétrograder un membre (ADMIN <-> MEMBER). Délègue toute la
 * logique d'autorisation à set_group_member_role() (SECURITY DEFINER,
 * supabase/migrations/0018_group_rls.sql) : seul le OWNER peut appeler,
 * jamais de rôle OWNER assignable ici, jamais le rôle du OWNER modifiable.
 * `newRole` volontairement restreint à ADMIN/MEMBER dans la validation —
 * défense en profondeur, la garde définitive reste côté fonction SQL.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let groupId: string;
  let targetUserId: string;
  let newRole: "ADMIN" | "MEMBER";
  try {
    const body = await req.json();
    groupId = requireUuid(body.groupId, "groupId");
    targetUserId = requireUuid(body.targetUserId, "targetUserId");
    newRole = requireEnum(body.newRole, "newRole", ["ADMIN", "MEMBER"] as const);
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();
  const { data, error } = await admin.rpc("set_group_member_role", {
    p_group_id: groupId,
    p_actor_id: user.id,
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });

  if (error) {
    const { text, status } = mapRoleError(error.message);
    return jsonResponse({ error: text }, status);
  }

  return jsonResponse({ member: data });
});

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { optionalString, requireEnum, requireString, ValidationError } from "../_shared/validate.ts";

function mapCreateGroupError(message: string): { text: string; status: number } {
  if (message.includes("name_required")) return { text: "Le nom du groupe est requis.", status: 400 };
  if (message.includes("name_too_long")) return { text: "Le nom du groupe est trop long (60 caractères max).", status: 400 };
  return { text: message, status: 500 };
}

/**
 * Correctif "création d'un groupe PRIVATE échoue" (mission "GROUPES SOCIAUX",
 * bug post-0019). Délègue à create_group() (SECURITY DEFINER,
 * supabase/migrations/0020_create_group_function.sql) : le RETURN d'une
 * fonction PL/pgSQL n'est jamais soumis à une ré-évaluation RLS (contrairement
 * au RETURNING d'un INSERT client direct, voir en-tête de cette migration),
 * ce qui fonctionne identiquement pour PUBLIC et PRIVATE.
 *
 * `owner_id` n'est JAMAIS lu depuis le corps de la requête — uniquement
 * dérivé de `user.id` (JWT vérifié), même principe que
 * start-direct-conversation/set-group-member-role.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let name: string;
  let description: string | undefined;
  let visibility: "PUBLIC" | "PRIVATE";
  try {
    const body = await req.json();
    name = requireString(body.name, "name", { min: 1, max: 60 });
    description = optionalString(body.description, "description", { max: 500 });
    visibility = requireEnum(body.visibility, "visibility", ["PUBLIC", "PRIVATE"] as const);
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();
  const { data, error } = await admin.rpc("create_group", {
    p_actor_id: user.id,
    p_name: name,
    p_description: description ?? null,
    p_visibility: visibility,
  });

  if (error) {
    const { text, status } = mapCreateGroupError(error.message);
    return jsonResponse({ error: text }, status);
  }

  return jsonResponse({ group: data });
});

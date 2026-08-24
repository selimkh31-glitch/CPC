import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireEnum, requireString, ValidationError } from "../_shared/validate.ts";
import {
  canInsertCompetition,
  COMPETITION_CREATE_STATUSES,
  COMPETITION_NAME_MAX,
  COMPETITION_NAME_MIN,
  normalizeCompetitionName,
} from "../_shared/competitions.ts";

/**
 * Crée une compétition virtuelle EA SPORTS FC 27 Pro Clubs.
 * `created_by` = JWT uniquement. Statut DRAFT | OPEN. RLS-safe en parallèle
 * (`competitions_insert_creator`) ; l'Edge valide et renvoie la ligne.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let name: string;
  let status: "DRAFT" | "OPEN";
  try {
    const body = await req.json();
    name = requireString(body.name, "name", { min: COMPETITION_NAME_MIN, max: COMPETITION_NAME_MAX });
    status = body.status === undefined || body.status === null || body.status === ""
      ? "OPEN"
      : requireEnum(body.status, "status", COMPETITION_CREATE_STATUSES);
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const normalized = normalizeCompetitionName(name);
  if (!normalized) {
    return jsonResponse({ error: `name doit contenir entre ${COMPETITION_NAME_MIN} et ${COMPETITION_NAME_MAX} caractères.` }, 400);
  }

  if (!canInsertCompetition({ actorId: user.id, createdBy: user.id, status })) {
    return jsonResponse({ error: "Statut invalide : DRAFT ou OPEN uniquement." }, 400);
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("competitions")
    .insert({ name: normalized, status, created_by: user.id })
    .select()
    .single();

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ competition: data });
});

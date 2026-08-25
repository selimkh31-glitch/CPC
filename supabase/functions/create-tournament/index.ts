import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireEnum, requireString, ValidationError } from "../_shared/validate.ts";
import {
  canInsertTournament,
  normalizeTournamentName,
  TOURNAMENT_COPY,
  TOURNAMENT_CREATE_STATUSES,
  TOURNAMENT_KIND,
  TOURNAMENT_NAME_MAX,
  TOURNAMENT_NAME_MIN,
} from "../_shared/tournaments.ts";

/**
 * Crée un tournoi virtuel EA SPORTS FC 27 Pro Clubs.
 * Même table `competitions`, kind=TOURNAMENT. created_by = JWT.
 * Statut DRAFT | OPEN. INSERT via service_role (RLS client = COMPETITION only).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let name: string;
  let status: "DRAFT" | "OPEN";
  try {
    const body = await req.json();
    name = requireString(body.name, "name", { min: TOURNAMENT_NAME_MIN, max: TOURNAMENT_NAME_MAX });
    status = body.status === undefined || body.status === null || body.status === ""
      ? "OPEN"
      : requireEnum(body.status, "status", TOURNAMENT_CREATE_STATUSES);
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const normalized = normalizeTournamentName(name);
  if (!normalized) {
    return jsonResponse({ error: `name doit contenir entre ${TOURNAMENT_NAME_MIN} et ${TOURNAMENT_NAME_MAX} caractères.` }, 400);
  }

  if (!canInsertTournament({ actorId: user.id, createdBy: user.id, status, kind: TOURNAMENT_KIND })) {
    return jsonResponse({ error: "Statut invalide : DRAFT ou OPEN uniquement." }, 400);
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("competitions")
    .insert({ name: normalized, status, created_by: user.id, kind: TOURNAMENT_KIND })
    .select()
    .single();

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ tournament: data });
});

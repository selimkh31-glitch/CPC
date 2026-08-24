import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";
import {
  canRegisterCompetitionClub,
  COMPETITION_COPY,
  registerBlockHttpStatus,
  registerBlockMessage,
  uniqueViolationHttpStatus,
} from "../_shared/competitions.ts";

/**
 * Inscrit un club géré (OWNER/MANAGER) à une compétition OPEN.
 * Unique (competition_id, club_id) : doublon → 409, jamais un 2e row.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let competitionId: string;
  let clubId: string;
  try {
    const body = await req.json();
    competitionId = requireUuid(body.competitionId, "competitionId");
    clubId = requireUuid(body.clubId, "clubId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: competition, error: competitionError } = await admin
    .from("competitions")
    .select("id, status")
    .eq("id", competitionId)
    .maybeSingle();
  if (competitionError) return jsonResponse({ error: competitionError.message }, 500);
  if (!competition) return jsonResponse({ error: COMPETITION_COPY.competitionNotFound }, 404);

  const { data: membership, error: membershipError } = await admin
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) return jsonResponse({ error: membershipError.message }, 500);

  const gate = canRegisterCompetitionClub({
    competitionStatus: competition.status,
    actorRole: membership?.role ?? null,
    alreadyRegistered: false,
  });
  if (!gate.ok) {
    return jsonResponse({ error: registerBlockMessage(gate.reason) }, registerBlockHttpStatus(gate.reason));
  }

  const { data, error } = await admin
    .from("competition_clubs")
    .insert({ competition_id: competitionId, club_id: clubId })
    .select()
    .single();

  if (error) {
    const conflict = uniqueViolationHttpStatus(error.code);
    if (conflict) return jsonResponse({ error: COMPETITION_COPY.registerConflict }, conflict);
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ registration: data });
});

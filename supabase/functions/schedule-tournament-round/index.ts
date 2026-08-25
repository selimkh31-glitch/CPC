import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";
import { uniqueViolationHttpStatus } from "../_shared/competitions.ts";
import {
  canScheduleFirstRound,
  MIN_CLUBS_TO_SCHEDULE,
  scheduleBlockHttpStatus,
  scheduleBlockMessage,
  scheduleFirstRoundFromClubs,
  TOURNAMENT_COPY,
} from "../_shared/tournaments.ts";

/**
 * Génère le premier tour d'un tournoi OPEN à partir des clubs réellement
 * inscrits (competition_clubs). Écrit des lignes tournament_matches SCHEDULED.
 * Jamais un bracket calculé seulement dans l'UI. < 2 clubs → 400, pas de rows.
 * Doublon (tour déjà généré) → 409. Créateur seulement.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let tournamentId: string;
  try {
    const body = await req.json();
    const raw = body.tournamentId ?? body.competitionId;
    tournamentId = requireUuid(raw, "tournamentId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: tournament, error: tournamentError } = await admin
    .from("competitions")
    .select("id, status, kind, created_by")
    .eq("id", tournamentId)
    .maybeSingle();
  if (tournamentError) return jsonResponse({ error: tournamentError.message }, 500);
  if (!tournament) return jsonResponse({ error: TOURNAMENT_COPY.tournamentNotFound }, 404);

  const { data: clubs, error: clubsError } = await admin
    .from("competition_clubs")
    .select("club_id")
    .eq("competition_id", tournamentId);
  if (clubsError) return jsonResponse({ error: clubsError.message }, 500);

  const { count: matchCount, error: matchCountError } = await admin
    .from("tournament_matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", tournamentId);
  if (matchCountError) return jsonResponse({ error: matchCountError.message }, 500);

  const clubIds = (clubs ?? []).map((row) => row.club_id).filter((id): id is string => typeof id === "string");
  const gate = canScheduleFirstRound({
    actorId: user.id,
    createdBy: tournament.created_by,
    status: tournament.status,
    kind: typeof tournament.kind === "string" ? tournament.kind : "",
    registeredClubCount: clubIds.length,
    existingMatchCount: matchCount ?? 0,
  });
  if (!gate.ok) {
    return jsonResponse({ error: scheduleBlockMessage(gate.reason) }, scheduleBlockHttpStatus(gate.reason));
  }

  const scheduled = scheduleFirstRoundFromClubs(clubIds);
  if (scheduled.pairings.length === 0) {
    return jsonResponse({ error: TOURNAMENT_COPY.needTwoClubs }, 400);
  }

  const rows = scheduled.pairings.map((pairing) => ({
    competition_id: tournamentId,
    round: pairing.round,
    slot: pairing.slot,
    club_a_id: pairing.clubAId,
    club_b_id: pairing.clubBId,
    status: pairing.status,
  }));

  const { data, error } = await admin.from("tournament_matches").insert(rows).select();
  if (error) {
    const conflict = uniqueViolationHttpStatus(error.code);
    if (conflict) return jsonResponse({ error: TOURNAMENT_COPY.scheduleLocked }, conflict);
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({
    matches: data ?? [],
    unpairedClubIds: scheduled.unpairedClubIds,
    round: scheduled.pairings[0]?.round ?? 1,
    clubCount: clubIds.length,
    minClubs: MIN_CLUBS_TO_SCHEDULE,
  });
});

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";
import { uniqueViolationHttpStatus } from "../_shared/competitions.ts";
import {
  canScheduleRound,
  MIN_CLUBS_TO_SCHEDULE,
  scheduleBlockHttpStatus,
  scheduleBlockMessage,
  scheduleRoundFromClubIds,
  TOURNAMENT_COPY,
  type TournamentLinkedResultInput,
  type TournamentMatchInput,
  type TournamentRoundClubInput,
} from "../_shared/tournaments.ts";

/**
 * Génère un tour persisté (1er ou suivant) depuis des clubs réels.
 * 1er tour : competition_clubs (≥2). Tours suivants : vainqueurs PLAYED
 * du tour courant + clubs du pool sans match. Jamais un bracket UI-only.
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

  const { data: matchRows, error: matchError } = await admin
    .from("tournament_matches")
    .select("id, competition_id, round, slot, club_a_id, club_b_id, status")
    .eq("competition_id", tournamentId);
  if (matchError) return jsonResponse({ error: matchError.message }, 500);

  const { data: roundClubRows, error: roundClubError } = await admin
    .from("tournament_round_clubs")
    .select("competition_id, round, club_id")
    .eq("competition_id", tournamentId);
  if (roundClubError) return jsonResponse({ error: roundClubError.message }, 500);

  const { data: resultRows, error: resultError } = await admin
    .from("match_results")
    .select("club_id, opponent_club_id, competition_id, outcome, our_score, opponent_score")
    .eq("competition_id", tournamentId)
    .not("opponent_club_id", "is", null);
  if (resultError) return jsonResponse({ error: resultError.message }, 500);

  const registeredClubIds = (clubs ?? [])
    .map((row) => row.club_id)
    .filter((id): id is string => typeof id === "string");
  const matches = (matchRows ?? []) as TournamentMatchInput[];
  const roundClubs = (roundClubRows ?? []) as TournamentRoundClubInput[];
  const results = (resultRows ?? []) as TournamentLinkedResultInput[];

  const gate = canScheduleRound({
    actorId: user.id,
    createdBy: tournament.created_by,
    status: tournament.status,
    kind: typeof tournament.kind === "string" ? tournament.kind : "",
    registeredClubIds,
    matches,
    results,
    roundClubs,
  });
  if (!gate.ok) {
    return jsonResponse({ error: scheduleBlockMessage(gate.reason) }, scheduleBlockHttpStatus(gate.reason));
  }

  const scheduled = scheduleRoundFromClubIds(gate.clubIds, gate.round);
  if (scheduled.pairings.length === 0) {
    return jsonResponse({ error: TOURNAMENT_COPY.needTwoClubs }, 400);
  }

  const roundClubInsert = gate.clubIds.map((clubId) => ({
    competition_id: tournamentId,
    round: gate.round,
    club_id: clubId,
  }));
  const { error: poolError } = await admin.from("tournament_round_clubs").insert(roundClubInsert);
  if (poolError) {
    const conflict = uniqueViolationHttpStatus(poolError.code);
    if (conflict) return jsonResponse({ error: TOURNAMENT_COPY.scheduleLocked }, conflict);
    return jsonResponse({ error: poolError.message }, 500);
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
    await admin
      .from("tournament_round_clubs")
      .delete()
      .eq("competition_id", tournamentId)
      .eq("round", gate.round);
    const conflict = uniqueViolationHttpStatus(error.code);
    if (conflict) return jsonResponse({ error: TOURNAMENT_COPY.scheduleLocked }, conflict);
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({
    matches: data ?? [],
    unpairedClubIds: scheduled.unpairedClubIds,
    round: gate.round,
    intent: gate.intent,
    clubCount: gate.clubIds.length,
    minClubs: MIN_CLUBS_TO_SCHEDULE,
  });
});

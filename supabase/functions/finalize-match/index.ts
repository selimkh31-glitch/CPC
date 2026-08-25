import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { optionalUuid, requireIntInRange, requireUuid, ValidationError } from "../_shared/validate.ts";
import { notifyUser } from "../_shared/notify.ts";
import { usersAreBlocked } from "../_shared/blocked.ts";
import {
  FINALIZE_MATCH_COPY,
  FINALIZE_SCORE_MAX,
  FINALIZE_SCORE_MIN,
  mapFinalizeError,
  shouldRefuseFinalizeOpponentOwner,
} from "../_shared/finalizeMatch.ts";
import {
  matchFinalizedCopy,
  matchFinalizedNotificationData,
  matchFinalizedRecipientIds,
} from "../_shared/safety.ts";

/**
 * Match Result Engine — l'owner/manager finalise le résultat d'un match
 * déjà check-in (score + MVP optionnel + club adverse CPC optionnel +
 * compétition optionnelle). `outcome` n'est jamais reçu du client : calculé
 * côté serveur dans finalize_match() (0014 + 0027).
 *
 * Garde Edge (en plus du RPC) : si opponentClubId, le owner de ce club ne
 * doit pas être dans la paire bloquée (les deux sens) — même règle que
 * filterClubsHiddenByBlock sur la recherche d'adversaire.
 *
 * Après RPC réussie : notif in-app MATCH_FINALIZED (create_notification via
 * notifyUser) aux club_members (OWNER/MANAGER/MEMBER) du club enregistreur
 * et, si opponent_club_id, du club adverse. Le recorder (JWT / recorded_by)
 * est exclu — il voit déjà le résultat à l'écran (MESSAGE_RECEIVED skip self).
 * Échec notify : log seulement, jamais de rollback du match_results (RPC
 * déjà commitée). Pas de notif chat GROUP/CLUB. Realtime = canal existant
 * notifications-${userId} ; pas de second canal.
 *
 * Unique match_checkin_id (0014 + unique_violation 0027) : 409 FR, pas de
 * 2e ligne. Client authenticated : aucune policy INSERT (service_role only).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let matchCheckinId: string;
  let ourScore: number;
  let opponentScore: number;
  let mvpUserId: string | null;
  let opponentClubId: string | null;
  let competitionId: string | null;
  try {
    const body = await req.json();
    matchCheckinId = requireUuid(body.matchCheckinId, "matchCheckinId");
    ourScore = requireIntInRange(body.ourScore, "ourScore", FINALIZE_SCORE_MIN, FINALIZE_SCORE_MAX);
    opponentScore = requireIntInRange(body.opponentScore, "opponentScore", FINALIZE_SCORE_MIN, FINALIZE_SCORE_MAX);
    mvpUserId = body.mvpUserId === undefined || body.mvpUserId === null ? null : requireUuid(body.mvpUserId, "mvpUserId");
    opponentClubId = optionalUuid(body.opponentClubId, "opponentClubId");
    competitionId = optionalUuid(body.competitionId, "competitionId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  if (opponentClubId) {
    const blocked = await refuseIfOpponentOwnerBlocked(admin, user.id, opponentClubId);
    if (blocked) return blocked;
  }

  const { data: result, error } = await admin.rpc("finalize_match", {
    p_match_checkin_id: matchCheckinId,
    p_actor_id: user.id,
    p_our_score: ourScore,
    p_opponent_score: opponentScore,
    p_mvp_user_id: mvpUserId,
    p_opponent_club_id: opponentClubId,
    p_competition_id: competitionId,
  });

  if (error) {
    const mapped = mapFinalizeError(error.message, error.code);
    return jsonResponse({ error: mapped.text }, mapped.status);
  }

  try {
    await notifyMatchFinalized(admin, result, user.id);
  } catch (err) {
    console.warn("[finalize-match] notify exception:", err);
  }

  return jsonResponse({ matchResult: result });
});

async function refuseIfOpponentOwnerBlocked(
  admin: ReturnType<typeof getAdminClient>,
  actorId: string,
  opponentClubId: string
): Promise<Response | null> {
  const { data: opponentClub, error } = await admin
    .from("clubs")
    .select("id, owner_id")
    .eq("id", opponentClubId)
    .maybeSingle();
  if (error) {
    console.warn("[finalize-match] opponent club:", error.message);
    return jsonResponse({ error: "Impossible de vérifier le club adverse." }, 500);
  }
  if (!opponentClub) {
    const mapped = mapFinalizeError("opponent_not_found");
    return jsonResponse({ error: mapped.text }, mapped.status);
  }
  const ownerId = typeof opponentClub.owner_id === "string" ? opponentClub.owner_id : null;
  if (!ownerId || ownerId === actorId) return null;

  const block = await usersAreBlocked(admin, actorId, ownerId);
  if (block.error) {
    console.error("[finalize-match] users_are_blocked:", block.error);
    return jsonResponse({ error: "Vérification de blocage indisponible." }, 500);
  }
  const blockedIds = block.blocked ? [ownerId] : [];
  if (
    shouldRefuseFinalizeOpponentOwner({
      actorId,
      opponentOwnerId: ownerId,
      blockedIds,
    })
  ) {
    return jsonResponse({ error: FINALIZE_MATCH_COPY.opponentBlocked }, 403);
  }
  return null;
}

function asMatchResultRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  return row as Record<string, unknown>;
}

async function notifyMatchFinalized(
  admin: ReturnType<typeof getAdminClient>,
  rawResult: unknown,
  recorderId: string
): Promise<void> {
  const result = asMatchResultRow(rawResult);
  const clubId = typeof result?.club_id === "string" ? result.club_id : null;
  if (!result || !clubId) return;

  const ourScore = Number(result.our_score);
  const opponentScore = Number(result.opponent_score);
  if (!Number.isFinite(ourScore) || !Number.isFinite(opponentScore)) return;

  const opponentClubId = typeof result.opponent_club_id === "string" ? result.opponent_club_id : null;
  const competitionId = typeof result.competition_id === "string" ? result.competition_id : null;
  const matchResultId = typeof result.id === "string" ? result.id : "";
  const matchCheckinId = typeof result.match_checkin_id === "string" ? result.match_checkin_id : "";
  const clubIds = opponentClubId ? [clubId, opponentClubId] : [clubId];

  const { data: clubs, error: clubsError } = await admin.from("clubs").select("id, name").in("id", clubIds);
  if (clubsError) console.warn("[finalize-match] notify clubs:", clubsError.message);
  const nameById = new Map<string, string>();
  for (const club of clubs ?? []) {
    if (typeof club.id === "string" && typeof club.name === "string") {
      nameById.set(club.id, club.name);
    }
  }

  const copy = matchFinalizedCopy({
    clubName: nameById.get(clubId) ?? "",
    opponentClubName: opponentClubId ? nameById.get(opponentClubId) ?? null : null,
    ourScore,
    opponentScore,
  });
  const data = matchFinalizedNotificationData({
    clubId,
    matchResultId,
    matchCheckinId,
    opponentClubId,
    competitionId,
  });

  const { data: members, error: membersError } = await admin
    .from("club_members")
    .select("club_id, user_id, user:users(id, push_token)")
    .in("club_id", clubIds);
  if (membersError) {
    console.warn("[finalize-match] notify members:", membersError.message);
    return;
  }

  const rows = members ?? [];
  const recipientIds = matchFinalizedRecipientIds({
    recordingClubMemberIds: rows.filter((row) => row.club_id === clubId).map((row) => row.user_id),
    opponentClubMemberIds: opponentClubId
      ? rows.filter((row) => row.club_id === opponentClubId).map((row) => row.user_id)
      : [],
    recorderId,
  });

  const tokenByUser = new Map<string, string | null>();
  for (const row of rows) {
    if (tokenByUser.has(row.user_id)) continue;
    tokenByUser.set(
      row.user_id,
      (row.user as { push_token?: string | null } | null)?.push_token ?? null
    );
  }

  for (const userId of recipientIds) {
    await notifyUser(admin, {
      userId,
      type: copy.type,
      title: copy.title,
      body: copy.body,
      data,
      pushToken: tokenByUser.get(userId),
    });
  }
}

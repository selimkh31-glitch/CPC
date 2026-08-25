import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { optionalUuid, requireIntInRange, requireUuid, ValidationError } from "../_shared/validate.ts";
import { notifyUser } from "../_shared/notify.ts";
import {
  matchFinalizedCopy,
  matchFinalizedNotificationData,
  matchFinalizedRecipientIds,
} from "../_shared/safety.ts";

function mapFinalizeError(message: string): { text: string; status: number } {
  if (message.includes("checkin_not_found")) return { text: "Match introuvable.", status: 404 };
  if (message.includes("not_authorized")) return { text: "Non autorisé.", status: 403 };
  if (message.includes("invalid_score")) return { text: "Score invalide.", status: 400 };
  if (message.includes("already_finalized")) return { text: "Ce match a déjà un résultat enregistré.", status: 409 };
  if (message.includes("mvp_not_present")) return { text: "Le MVP doit avoir été présent à ce match.", status: 400 };
  if (message.includes("opponent_is_self")) return { text: "Le club adverse doit être distinct du tien.", status: 400 };
  if (message.includes("opponent_not_found")) return { text: "Club adverse introuvable.", status: 404 };
  if (message.includes("competition_requires_opponent")) {
    return { text: "Une compétition ne peut être liée que si un club adverse est choisi.", status: 400 };
  }
  if (message.includes("competition_not_found")) return { text: "Compétition introuvable.", status: 404 };
  if (message.includes("competition_not_open")) return { text: "On ne peut lier qu'une compétition ouverte.", status: 400 };
  if (message.includes("clubs_not_in_competition")) {
    return { text: "Les deux clubs doivent être inscrits à cette compétition.", status: 400 };
  }
  return { text: message, status: 500 };
}

/**
 * Match Result Engine — l'owner/manager finalise le résultat d'un match
 * déjà check-in (score + MVP optionnel + club adverse CPC optionnel +
 * compétition optionnelle). `outcome` n'est jamais reçu du client : calculé
 * côté serveur dans finalize_match() (0014 + 0027).
 *
 * Après RPC réussie : notif in-app MATCH_FINALIZED (create_notification via
 * notifyUser) aux club_members (OWNER/MANAGER/MEMBER) du club enregistreur
 * et, si opponent_club_id, du club adverse. Le recorder (JWT / recorded_by)
 * est exclu — il voit déjà le résultat à l'écran (MESSAGE_RECEIVED skip self).
 * Échec notify : log seulement, jamais de rollback du match_results (RPC
 * déjà commitée). Pas de notif chat GROUP/CLUB. Realtime = canal existant
 * notifications-${userId} ; pas de second canal.
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
    ourScore = requireIntInRange(body.ourScore, "ourScore", 0, 99);
    opponentScore = requireIntInRange(body.opponentScore, "opponentScore", 0, 99);
    mvpUserId = body.mvpUserId === undefined || body.mvpUserId === null ? null : requireUuid(body.mvpUserId, "mvpUserId");
    opponentClubId = optionalUuid(body.opponentClubId, "opponentClubId");
    competitionId = optionalUuid(body.competitionId, "competitionId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

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
    const { text, status } = mapFinalizeError(error.message);
    return jsonResponse({ error: text }, status);
  }

  try {
    await notifyMatchFinalized(admin, result, user.id);
  } catch (err) {
    console.warn("[finalize-match] notify exception:", err);
  }

  return jsonResponse({ matchResult: result });
});

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

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { sendPushNotification } from "../_shared/push.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";

function mapCheckinError(message: string): { text: string; status: number } {
  if (message.includes("not_authorized")) return { text: "Non autorisé.", status: 403 };
  if (message.includes("session_not_found")) return { text: "Session introuvable pour ce club.", status: 404 };
  if (message.includes("session_not_live")) return { text: "Ce club n'est pas en live actuellement.", status: 409 };
  if (message.includes("no_formation_set")) return { text: "Choisis une formation avant de lancer le match.", status: 409 };
  return { text: message, status: 500 };
}

function parseUuidArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`${field} doit être un tableau.`);
  return value.map((v, i) => requireUuid(v, `${field}[${i}]`));
}

/**
 * Check-in / lancement du match (Phase 5, sections J-M) — la fonction la
 * plus complexe : titulaires/absences/présences, matches_played_count,
 * libération des slots absents (réutilisable tel quel par player-search/
 * invite-to-slot existants — aucun nouveau moteur de matching), et
 * finalisation atomique des départs ACCEPTED_NEXT_MATCH dont le titulaire
 * vient d'être marqué présent (le tout dans launch_match_checkin(),
 * 0012_engagement_functions.sql).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let clubId: string;
  let sessionId: string;
  let absentUserIds: string[];
  try {
    const body = await req.json();
    clubId = requireUuid(body.clubId, "clubId");
    sessionId = requireUuid(body.sessionId, "sessionId");
    absentUserIds = parseUuidArray(body.absentUserIds, "absentUserIds");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: result, error } = await admin.rpc("launch_match_checkin", {
    p_club_id: clubId,
    p_session_id: sessionId,
    p_actor_id: user.id,
    p_absent_user_ids: absentUserIds,
  });

  if (error) {
    const { text, status } = mapCheckinError(error.message);
    return jsonResponse({ error: text }, status);
  }

  const { data: club } = await admin.from("clubs").select("name").eq("id", clubId).maybeSingle();

  // Notifie les joueurs marqués absents.
  if (result.absentUserIds?.length) {
    const { data: absentPlayers } = await admin.from("users").select("id, push_token").in("id", result.absentUserIds);
    for (const p of absentPlayers ?? []) {
      await sendPushNotification(
        p.push_token,
        "Absence signalée",
        `Tu as été marqué absent pour ce match chez ${club?.name ?? "ton club"} — il ne comptera pas comme match joué.`,
        { type: "match_absent", clubId }
      );
    }
  }

  // Notifie les départs finalisés (libération immédiate ou transition).
  for (const f of result.finalizedDepartures ?? []) {
    const { data: player } = await admin.from("users").select("push_token").eq("id", f.userId).maybeSingle();
    if (f.transitioned) {
      const { data: targetClub } = await admin.from("clubs").select("name").eq("id", f.targetClubId).maybeSingle();
      await sendPushNotification(
        player?.push_token,
        "Transition terminée 🎉",
        `Ton dernier match chez ${club?.name ?? "ton ancien club"} est validé — tu rejoins officiellement ${targetClub?.name ?? "ton nouveau club"}.`,
        { type: "transition_completed", clubId: f.targetClubId }
      );
      const { data: newManagers } = await admin
        .from("club_members")
        .select("user:users(push_token)")
        .eq("club_id", f.targetClubId)
        .in("role", ["OWNER", "MANAGER"]);
      for (const m of newManagers ?? []) {
        await sendPushNotification(
          (m as any).user?.push_token,
          "Nouveau joueur dans l'effectif",
          "Une transition programmée vient de se finaliser.",
          { type: "transition_completed", clubId: f.targetClubId }
        );
      }
    } else {
      await sendPushNotification(
        player?.push_token,
        "Tu es libre 🔓",
        `Ton dernier match chez ${club?.name ?? "ton club"} est validé — tu es maintenant libre de rejoindre un autre club.`,
        { type: "departure_finalized" }
      );
    }
  }

  return jsonResponse(result);
});

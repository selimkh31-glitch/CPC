import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { FEATURE_EA_STATS, resolveEaClubId, fetchVerifiedClubStats } from "../_shared/ea.ts";
import { computeReliabilityScore } from "../_shared/reliability.ts";
import { requireString, ValidationError } from "../_shared/validate.ts";

/**
 * Lie le compte joueur à un club EA par nom (section 4). Best-effort et
 * non-bloquant : si l'API EA est down, on répond quand même avec `synced:false`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!FEATURE_EA_STATS) return jsonResponse({ error: "Module stats EA désactivé." }, 503);

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let eaClubName: string;
  try {
    const body = await req.json();
    eaClubName = requireString(body.eaClubName, "eaClubName", { min: 2, max: 60 });
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();
  const { data: profile } = await admin.from("users").select("*").eq("id", user.id).single();
  if (!profile) return jsonResponse({ error: "Profil introuvable" }, 404);

  const eaClubId = await resolveEaClubId(eaClubName);
  if (!eaClubId) {
    return jsonResponse(
      { error: "Club EA introuvable (ou API EA momentanément indisponible). Réessaie plus tard." },
      502
    );
  }

  await admin.from("users").update({ ea_club_linked: eaClubId }).eq("id", user.id);

  const statsByName = await fetchVerifiedClubStats(eaClubId);
  const mine = statsByName?.[profile.username.trim().toLowerCase()] ?? null;

  if (mine) {
    const { data: reviews } = await admin.from("reviews").select("*").eq("target_user_id", user.id);
    const reliabilityScore = computeReliabilityScore({
      reviews: (reviews ?? []).map((r: any) => ({
        ratingSkill: r.rating_skill,
        ratingBehavior: r.rating_behavior,
        showedUp: r.showed_up,
      })),
      currentStreak: profile.current_streak,
      verifiedStats: mine,
    });
    await admin.from("users").update({ verified_stats: mine, reliability_score: reliabilityScore }).eq("id", user.id);
  }

  return jsonResponse({ eaClubId, synced: Boolean(mine), stats: mine });
});

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { moderateText } from "../_shared/ai.ts";
import { computeReliabilityScore, nextStreak, streakBadgesEarned } from "../_shared/reliability.ts";
import { optionalString, requireBoolean, requireIntInRange, requireUuid, ValidationError } from "../_shared/validate.ts";

/**
 * Trust Engine — check post-session ("présent / a lâché / bon esprit").
 * Crée la review, met à jour le streak et recalcule reliability_score (section 9).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let targetUserId: string;
  let ratingSkill: number;
  let ratingBehavior: number;
  let showedUp: boolean;
  let comment: string | undefined;
  try {
    const body = await req.json();
    targetUserId = requireUuid(body.targetUserId, "targetUserId");
    ratingSkill = requireIntInRange(body.ratingSkill, "ratingSkill", 1, 5);
    ratingBehavior = requireIntInRange(body.ratingBehavior, "ratingBehavior", 1, 5);
    showedUp = requireBoolean(body.showedUp, "showedUp");
    comment = optionalString(body.comment, "comment", { max: 300 });
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }
  if (targetUserId === user.id) return jsonResponse({ error: "Impossible de se noter soi-même." }, 400);

  if (comment) {
    const moderation = await moderateText(comment);
    if (moderation.toxic) return jsonResponse({ error: "Commentaire refusé par la modération." }, 422);
  }

  const admin = getAdminClient();

  const { data: review, error } = await admin
    .from("reviews")
    .insert({
      reviewer_id: user.id,
      target_user_id: targetUserId,
      rating_skill: ratingSkill,
      rating_behavior: ratingBehavior,
      showed_up: showedUp,
      comment: comment || null,
    })
    .select()
    .single();
  if (error) return jsonResponse({ error: error.message }, 500);

  const { data: target } = await admin.from("users").select("*").eq("id", targetUserId).single();
  if (target) {
    const { data: allReviews } = await admin.from("reviews").select("*").eq("target_user_id", target.id);
    const streak = nextStreak(target.current_streak, showedUp);
    const reliabilityScore = computeReliabilityScore({
      reviews: (allReviews ?? []).map((r: any) => ({
        ratingSkill: r.rating_skill,
        ratingBehavior: r.rating_behavior,
        showedUp: r.showed_up,
      })),
      currentStreak: streak,
      verifiedStats: target.verified_stats,
    });
    const earnedBadges = streakBadgesEarned(streak);
    const existingBadges: string[] = Array.isArray(target.badges) ? target.badges : [];
    const badges = Array.from(new Set([...existingBadges, ...earnedBadges]));

    await admin
      .from("users")
      .update({
        current_streak: streak,
        best_streak: Math.max(target.best_streak, streak),
        reliability_score: reliabilityScore,
        badges,
      })
      .eq("id", target.id);
  }

  return jsonResponse({ review });
});

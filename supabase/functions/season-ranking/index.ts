import { jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const DIVISION_COUNT = 5; // division 1 = élite ... 5 = débutants

/**
 * Job de calcul de classement (section 3.F) — cron Supabase quotidien/hebdo.
 * Recalcule les divisions par percentile de points sur la saison active et
 * attribue les badges de saison affichés sur la ClubPro Card.
 */
Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) return jsonResponse({ error: "Non autorisé" }, 401);

  const admin = getAdminClient();

  const { data: season } = await admin.from("seasons").select("*").eq("is_active", true).maybeSingle();
  if (!season) return jsonResponse({ skipped: true, reason: "Aucune saison active" });

  const { data: stats } = await admin
    .from("season_stats")
    .select("*")
    .eq("season_id", season.id)
    .order("points", { ascending: false });
  if (!stats || stats.length === 0) return jsonResponse({ skipped: true, reason: "Aucune stat de saison" });

  for (let i = 0; i < stats.length; i++) {
    const percentile = i / stats.length;
    const division = Math.min(DIVISION_COUNT, Math.floor(percentile * DIVISION_COUNT) + 1);
    await admin.from("season_stats").update({ division }).eq("id", stats[i].id);
  }

  const top = (key: string) => [...stats].sort((a: any, b: any) => b[key] - a[key])[0];
  const awards = [
    { row: top("goals"), badge: `season_${season.id}_top_scorer` },
    { row: top("assists"), badge: `season_${season.id}_top_assist` },
    { row: top("clean_sheets"), badge: `season_${season.id}_top_keeper` },
    { row: top("mvp_count"), badge: `season_${season.id}_top_mvp` },
  ].filter((a) => a.row);

  for (const award of awards) {
    const { data: user } = await admin.from("users").select("badges").eq("id", award.row.user_id).single();
    if (!user) continue;
    const existing: string[] = Array.isArray(user.badges) ? user.badges : [];
    if (!existing.includes(award.badge)) {
      await admin.from("users").update({ badges: [...existing, award.badge] }).eq("id", award.row.user_id);
    }
  }

  return jsonResponse({ updated: stats.length, awards: awards.length });
});

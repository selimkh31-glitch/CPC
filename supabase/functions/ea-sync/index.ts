import { jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { FEATURE_EA_STATS } from "../_shared/ea.ts";
import { eaProvider } from "../_shared/ea/proClubsAdapter.ts";
import { ingestEaClubFromProvider } from "../_shared/ea/ingest.ts";
import { buildVerifiedStatsForPlayer } from "../_shared/ea/verified.ts";
import { computeReliabilityScore } from "../_shared/reliability.ts";

/**
 * Job planifié quotidien — cron Supabase (pg_cron -> pg_net). Ingest
 * unofficial /api/fc (snapshot club, membres, carrière, matchs ligue/
 * amical/playoff) dans ea_imported_*. Skip matchId déjà en table.
 * verified_stats du user : skip incrémental importedMatchIds.
 * L'app mobile ne lit JAMAIS proclubs.ea.com. Protégé par CRON_SECRET.
 */
Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) return jsonResponse({ error: "Non autorisé" }, 401);
  if (!FEATURE_EA_STATS) return jsonResponse({ skipped: true, reason: "FEATURE_EA_STATS désactivé" });

  const admin = getAdminClient();

  const { data: usersWithClub } = await admin.from("users").select("*").not("ea_club_linked", "is", null);
  const byClub = new Map<string, any[]>();
  for (const u of usersWithClub ?? []) {
    const key = u.ea_club_linked as string;
    byClub.set(key, [...(byClub.get(key) ?? []), u]);
  }

  const { data: activeSeason } = await admin.from("seasons").select("*").eq("is_active", true).maybeSingle();

  let updated = 0;
  let failed = 0;

  for (const [eaClubId, users] of byClub) {
    const { matches } = await ingestEaClubFromProvider(admin, eaProvider, eaClubId, "common-gen5");
    if (!matches) {
      failed += users.length;
      continue; // fallback silencieux : on garde les anciennes valeurs en cache
    }

    for (const u of users) {
      const mine = buildVerifiedStatsForPlayer(
        matches,
        u.username,
        u.verified_stats,
        eaProvider.name,
        eaClubId,
        "common-gen5"
      );
      if (!mine) continue;

      const { data: reviews } = await admin.from("reviews").select("*").eq("target_user_id", u.id);
      const reliabilityScore = computeReliabilityScore({
        reviews: (reviews ?? []).map((r: { rating_skill: number; rating_behavior: number; showed_up: boolean }) => ({
          ratingSkill: r.rating_skill,
          ratingBehavior: r.rating_behavior,
          showedUp: r.showed_up,
        })),
        currentStreak: u.current_streak,
        verifiedStats: mine,
      });

      await admin.from("users").update({ verified_stats: mine, reliability_score: reliabilityScore }).eq("id", u.id);

      if (activeSeason) {
        const points = mine.goals * 4 + mine.assists * 3 + mine.cleanSheets * 2;
        await admin.from("season_stats").upsert(
          {
            season_id: activeSeason.id,
            user_id: u.id,
            goals: mine.goals,
            assists: mine.assists,
            clean_sheets: mine.cleanSheets,
            matches_played: mine.matchesPlayed,
            points,
          },
          { onConflict: "season_id,user_id" }
        );
      }

      updated += 1;
    }
  }

  return jsonResponse({ updated, failed, clubsProcessed: byClub.size });
});

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { rankLiveClubsForPlayer } from "../_shared/liveMatch.ts";

/**
 * Matching LIVE déterministe (P1) — poste + plateforme owner + expiry + besoin.
 * Plus d'appel IA ici (clés placeholder, reco non explicable).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  const admin = getAdminClient();
  await admin.rpc("expire_stale_live_sessions");

  const { data: player } = await admin.from("users").select("*").eq("id", user.id).single();
  if (!player) return jsonResponse({ error: "Profil introuvable" }, 404);

  const { data: liveSessions } = await admin
    .from("club_sessions")
    .select("*, club:clubs(id,name,level,languages,owner_id, owner:users(platform))")
    .eq("is_live", true)
    .gt("expires_at", new Date().toISOString())
    .limit(40);

  const clubs = (liveSessions ?? [])
    .filter((s: any) => s.club)
    .map((s: any) => ({
      clubId: s.club.id,
      sessionId: s.id,
      neededPositions: s.needed_positions ?? [],
      platform: s.club.owner?.platform ?? null,
      is_live: Boolean(s.is_live),
      expires_at: s.expires_at ?? null,
    }));

  const matches = rankLiveClubsForPlayer(
    {
      mainPosition: player.main_position,
      secondaryPositions: player.secondary_positions ?? [],
      platform: player.platform,
    },
    clubs,
    Date.now()
  ).map((m) => ({ clubId: m.clubId, sessionId: m.sessionId, score: m.score, reason: m.reason }));

  return jsonResponse({ matches });
});

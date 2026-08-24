import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { computeSmartMatch } from "../_shared/ai.ts";

/**
 * Smart Match (section 5) — classe les clubs live par compatibilité avec le
 * joueur connecté. Fallback déterministe automatique si l'IA est indisponible.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  const admin = getAdminClient();
  const { data: player } = await admin.from("users").select("*").eq("id", user.id).single();
  if (!player) return jsonResponse({ error: "Profil introuvable" }, 404);

  const { data: liveSessions } = await admin
    .from("club_sessions")
    .select("*, club:clubs(*)")
    .eq("is_live", true)
    .gt("expires_at", new Date().toISOString())
    .limit(30);

  const clubs = (liveSessions ?? [])
    .filter((s: any) => s.club)
    .map((s: any) => ({
      id: s.club.id,
      sessionId: s.id,
      level: s.club.level,
      languages: s.club.languages,
      neededPositions: s.needed_positions,
    }));

  const matches = await computeSmartMatch(
    {
      mainPosition: player.main_position,
      secondaryPositions: player.secondary_positions,
      languages: player.languages,
      playStyle: player.play_style,
      reliabilityScore: player.reliability_score,
    },
    clubs
  );

  return jsonResponse({ matches });
});

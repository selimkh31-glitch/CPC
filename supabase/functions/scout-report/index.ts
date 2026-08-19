import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { generateScoutReport } from "../_shared/ai.ts";

/** Scout Report IA (section 5) — feature Pro (section 6). */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  const admin = getAdminClient();
  const { data: profile } = await admin.from("users").select("*").eq("id", user.id).single();
  if (!profile) return jsonResponse({ error: "Profil introuvable" }, 404);
  if (profile.plan !== "PRO") return jsonResponse({ error: "Scout Report réservé au plan Pro." }, 402);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: reviews } = await admin
    .from("reviews")
    .select("*")
    .eq("target_user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const report = await generateScoutReport(reviews ?? [], profile.verified_stats);
  return jsonResponse({ report });
});

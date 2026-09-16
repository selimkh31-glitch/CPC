import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireEnum, requireString, requireUuid, ValidationError } from "../_shared/validate.ts";

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"] as const;

/**
 * Membre LIVE : prend un slot vacant. RLS slot_assignments_write_manager
 * bloque l'INSERT client d'un MEMBER — d'où cette Edge (service_role).
 * Ne crée jamais club_members. Ne mappe pas un poste vers un voisin (LW ≠ LM).
 */
function isLiveNow(session: { is_live: boolean; expires_at: string | null }, nowMs: number): boolean {
  if (!session.is_live || !session.expires_at) return false;
  const t = new Date(session.expires_at).getTime();
  return Number.isFinite(t) && t > nowMs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let clubId: string;
  let slotId: string;
  let position: (typeof POSITIONS)[number];
  try {
    const body = await req.json();
    clubId = requireUuid(body.clubId, "clubId");
    slotId = requireString(body.slotId, "slotId", { min: 1, max: 20 });
    position = requireEnum(body.position, "position", POSITIONS);
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: membership } = await admin
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return jsonResponse({ error: "Rejoins le club avant de prendre un poste." }, 403);
  }

  const { data: existingSlot } = await admin
    .from("slot_assignments")
    .select("id, slot_id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingSlot) {
    if (existingSlot.slot_id === slotId) {
      return jsonResponse({ ok: true, alreadyClaimed: true, clubId, slotId });
    }
    return jsonResponse({ error: "Tu as déjà un poste sur cette feuille." }, 409);
  }

  const { data: taken } = await admin
    .from("slot_assignments")
    .select("id")
    .eq("club_id", clubId)
    .eq("slot_id", slotId)
    .maybeSingle();
  if (taken) {
    return jsonResponse({ error: "Ce poste vient d'être pris." }, 409);
  }

  const { error } = await admin.from("slot_assignments").insert({
    club_id: clubId,
    slot_id: slotId,
    user_id: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return jsonResponse({ error: "Ce poste vient d'être pris." }, 409);
    }
    return jsonResponse({ error: error.message }, 500);
  }

  const { data: sessions } = await admin
    .from("club_sessions")
    .select("id, is_live, expires_at, needed_positions")
    .eq("club_id", clubId)
    .eq("is_live", true);
  const live = (sessions ?? []).find((row) => isLiveNow(row, Date.now()));
  if (live) {
    const needed = [...((live.needed_positions as string[] | null) ?? [])];
    const idx = needed.indexOf(position);
    if (idx >= 0) needed.splice(idx, 1);
    const patch = needed.length === 0 ? { is_live: false, needed_positions: needed } : { needed_positions: needed };
    await admin.from("club_sessions").update(patch).eq("id", live.id);
  }

  return jsonResponse({ ok: true, alreadyClaimed: false, clubId, slotId });
});

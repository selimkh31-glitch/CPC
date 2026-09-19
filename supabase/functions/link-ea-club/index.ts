import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { FEATURE_EA_STATS } from "../_shared/ea.ts";
import { eaProvider } from "../_shared/ea/proClubsAdapter.ts";
import { confirmClubInSearch, parseEaClubId } from "../_shared/ea/normalize.ts";
import type { EAClub } from "../_shared/ea/types.ts";
import { buildVerifiedStatsForPlayer } from "../_shared/ea/verified.ts";
import { computeReliabilityScore } from "../_shared/reliability.ts";
import { requireEaClubId, requireEnum, requireString, requireUuid, ValidationError } from "../_shared/validate.ts";

type AdminClient = ReturnType<typeof getAdminClient>;

async function callerCanLinkManagedClub(admin: AdminClient, userId: string, cpcClubId: string): Promise<boolean> {
  const { data: membership } = await admin
    .from("club_members")
    .select("role")
    .eq("club_id", cpcClubId)
    .eq("user_id", userId)
    .in("role", ["OWNER", "MANAGER"])
    .maybeSingle();
  return Boolean(membership);
}

const LINK_ACTIONS = ["search", "preview", "link", "unlink", "link-club", "unlink-club"] as const;

function toCandidate(c: EAClub) {
  return {
    clubId: c.externalId,
    name: c.name,
    platform: c.externalPlatform,
    rank: c.rank,
    gamesPlayed: c.gamesPlayed,
  };
}

/**
 * Lie le compte joueur à un club EA (JWT). Jamais de first-hit :
 *  - search  : { eaClubName } → candidats { clubId, name, platform? }, aucun write.
 *  - preview : { eaClubId, eaClubName } → re-search + top 3 membres (best-effort).
 *  - link    : { eaClubId, eaClubName } → re-search, clubId numérique requis, puis
 *              update CALLER (USERNAME_EQUALITY). Retour { clubId, name }.
 *  - unlink  : clear ea_club_linked pour relier un autre id.
 *  - link-club   : { cpcClubId, eaClubId, eaClubName } → clubs.ea_club_id (owner/manager).
 *  - unlink-club : { cpcClubId } → clear clubs.ea_club_id.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!FEATURE_EA_STATS) return jsonResponse({ error: "Module stats EA désactivé." }, 503);

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  let action: (typeof LINK_ACTIONS)[number];
  try {
    action = requireEnum(body.action, "action", LINK_ACTIONS);
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  if (action === "unlink") {
    const admin = getAdminClient();
    await admin.from("users").update({ ea_club_linked: null, ea_identity_kind: "NONE" }).eq("id", user.id);
    return jsonResponse({ unlinked: true });
  }

  if (action === "unlink-club") {
    let cpcClubId: string;
    try {
      cpcClubId = requireUuid(body.cpcClubId, "cpcClubId");
    } catch (err) {
      if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
      return jsonResponse({ error: "Corps de requête invalide." }, 400);
    }
    const admin = getAdminClient();
    const allowed = await callerCanLinkManagedClub(admin, user.id, cpcClubId);
    if (!allowed) return jsonResponse({ error: "Seul l'owner ou un manager peut délier ce club." }, 403);
    await admin.from("clubs").update({ ea_club_id: null }).eq("id", cpcClubId);
    return jsonResponse({ unlinked: true });
  }

  if (action === "search") {
    let eaClubName: string;
    try {
      eaClubName = requireString(body.eaClubName, "eaClubName", { min: 2, max: 60 });
    } catch (err) {
      if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
      return jsonResponse({ error: "Corps de requête invalide." }, 400);
    }

    const clubs = await eaProvider.searchClub(eaClubName);
    if (clubs === null) {
      return jsonResponse({ candidates: [], unavailable: true });
    }
    return jsonResponse({
      candidates: clubs.map(toCandidate),
      unavailable: false,
    });
  }

  let eaClubName: string;
  let eaClubId: string;
  try {
    eaClubName = requireString(body.eaClubName, "eaClubName", { min: 2, max: 60 });
    eaClubId = requireEaClubId(body.eaClubId, "eaClubId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  if (!parseEaClubId(eaClubId)) {
    return jsonResponse({ error: "eaClubId doit être l'identifiant numérique EA (clubId), pas un regionId." }, 400);
  }

  const clubs = await eaProvider.searchClub(eaClubName);
  if (clubs === null) {
    return jsonResponse(
      { error: "Club EA introuvable (ou endpoints EA momentanément indisponibles). Réessaie plus tard." },
      502
    );
  }

  const confirmed = confirmClubInSearch(clubs, eaClubId);
  if (!confirmed) {
    return jsonResponse({ error: "Club EA inconnu pour ce nom. Choisis un club dans la liste." }, 400);
  }

  if (action === "preview") {
    let memberNames: string[] = [];
    try {
      const members = await eaProvider.getClubMembers(confirmed.externalId, confirmed.externalPlatform ?? undefined);
      memberNames = (members ?? []).map((m) => m.name).filter(Boolean).slice(0, 3);
    } catch {
      memberNames = [];
    }
    return jsonResponse({
      clubId: confirmed.externalId,
      name: confirmed.name,
      platform: confirmed.externalPlatform,
      members: memberNames,
    });
  }

  const admin = getAdminClient();

  if (action === "link-club") {
    let cpcClubId: string;
    try {
      cpcClubId = requireUuid(body.cpcClubId, "cpcClubId");
    } catch (err) {
      if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
      return jsonResponse({ error: "Corps de requête invalide." }, 400);
    }
    const allowed = await callerCanLinkManagedClub(admin, user.id, cpcClubId);
    if (!allowed) return jsonResponse({ error: "Seul l'owner ou un manager peut lier ce club." }, 403);
    await admin.from("clubs").update({ ea_club_id: confirmed.externalId }).eq("id", cpcClubId);
    return jsonResponse({
      eaClubId: confirmed.externalId,
      clubId: confirmed.externalId,
      name: confirmed.name,
      synced: false,
    });
  }

  const { data: profile } = await admin.from("users").select("*").eq("id", user.id).single();
  if (!profile) return jsonResponse({ error: "Profil introuvable" }, 404);

  await admin
    .from("users")
    .update({ ea_club_linked: confirmed.externalId, ea_identity_kind: "USERNAME_EQUALITY" })
    .eq("id", user.id);

  const matches = await eaProvider.getClubMatches(confirmed.externalId);
  if (matches === null) {
    return jsonResponse({
      eaClubId: confirmed.externalId,
      clubId: confirmed.externalId,
      name: confirmed.name,
      synced: false,
      stats: null,
    });
  }

  const mine = buildVerifiedStatsForPlayer(
    matches,
    profile.username,
    profile.verified_stats,
    eaProvider.name,
    confirmed.externalId,
    confirmed.externalPlatform
  );

  if (mine) {
    const { data: reviews } = await admin.from("reviews").select("*").eq("target_user_id", user.id);
    const reliabilityScore = computeReliabilityScore({
      reviews: (reviews ?? []).map((r: { rating_skill: number; rating_behavior: number; showed_up: boolean }) => ({
        ratingSkill: r.rating_skill,
        ratingBehavior: r.rating_behavior,
        showedUp: r.showed_up,
      })),
      currentStreak: profile.current_streak,
      verifiedStats: mine,
    });
    await admin.from("users").update({ verified_stats: mine, reliability_score: reliabilityScore }).eq("id", user.id);
  }

  return jsonResponse({
    eaClubId: confirmed.externalId,
    clubId: confirmed.externalId,
    name: confirmed.name,
    synced: Boolean(mine),
    stats: mine,
  });
});

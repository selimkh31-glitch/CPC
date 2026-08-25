import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { FEATURE_EA_STATS } from "../_shared/ea.ts";
import { eaProvider } from "../_shared/ea/proClubsAdapter.ts";
import { confirmClubInSearch } from "../_shared/ea/normalize.ts";
import { ingestEaClubFromProvider, loadProductClubHistory } from "../_shared/ea/ingest.ts";
import { buildEaProductDisplay } from "../_shared/ea/display.ts";
import { getLiveEaTitle, PRODUCT_EA_TITLE, writesToProductLedger } from "../_shared/ea/title.ts";
import { buildVerifiedStatsForPlayer } from "../_shared/ea/verified.ts";
import { computeReliabilityScore } from "../_shared/reliability.ts";
import { requireEnum, requireString, ValidationError } from "../_shared/validate.ts";

const LINK_ACTIONS = ["search", "link", "history"] as const;

/**
 * Lie le compte joueur à un club EA (JWT). Actions, jamais de first-hit :
 *  - search : { eaClubName } → candidats { clubId, name }, aucun write.
 *  - link   : { eaClubId, eaClubName } → re-search, confirm, caller only.
 *             Ingest sous EA_FC_TITLE (live). verified_stats seulement si
 *             live === fc27 (ledger produit). Payload history fc27 honnête
 *             (vide avant cutover).
 *  - history : { eaClubId, playername? } → vues fc27 club / effectif / matchs / joueur.
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
      candidates: clubs.map((c) => ({ clubId: c.externalId, name: c.name })),
      unavailable: false,
      liveTitle: getLiveEaTitle(),
      productTitle: PRODUCT_EA_TITLE,
    });
  }

  if (action === "history") {
    let eaClubId: string;
    let playername = "";
    try {
      eaClubId = requireString(body.eaClubId, "eaClubId", { min: 1, max: 64 });
      if (body.playername != null && body.playername !== "") {
        playername = requireString(body.playername, "playername", { min: 1, max: 60 });
      }
    } catch (err) {
      if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
      return jsonResponse({ error: "Corps de requête invalide." }, 400);
    }
    const admin = getAdminClient();
    const productLedger = await loadProductClubHistory(admin, eaClubId, "common-gen5");
    const display = buildEaProductDisplay(productLedger, playername || null);
    return jsonResponse({
      liveTitle: getLiveEaTitle(),
      productTitle: PRODUCT_EA_TITLE,
      eaTitle: display.eaTitle,
      club: display.club,
      members: display.members,
      matches: display.matches,
      player: display.player,
    });
  }

  let eaClubName: string;
  let eaClubId: string;
  try {
    eaClubName = requireString(body.eaClubName, "eaClubName", { min: 2, max: 60 });
    eaClubId = requireString(body.eaClubId, "eaClubId", { min: 1, max: 64 });
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
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

  const admin = getAdminClient();
  const { data: profile } = await admin.from("users").select("*").eq("id", user.id).single();
  if (!profile) return jsonResponse({ error: "Profil introuvable" }, 404);

  await admin
    .from("users")
    .update({ ea_club_linked: confirmed.externalId, ea_identity_kind: "USERNAME_EQUALITY" })
    .eq("id", user.id);

  const liveTitle = getLiveEaTitle();
  const platform = confirmed.externalPlatform ?? "common-gen5";
  const { plan, matches } = await ingestEaClubFromProvider(
    admin,
    eaProvider,
    confirmed.externalId,
    platform,
    liveTitle
  );
  const productLedger = await loadProductClubHistory(admin, confirmed.externalId, platform);
  const display = buildEaProductDisplay(productLedger, profile.username);
  const ingestMeta = {
    title: liveTitle,
    members: plan.memberRows.length,
    matches: plan.newMatches.length,
  };

  if (matches === null) {
    return jsonResponse({
      eaClubId: confirmed.externalId,
      synced: false,
      stats: null,
      liveTitle,
      productTitle: PRODUCT_EA_TITLE,
      ingested: ingestMeta,
      eaTitle: display.eaTitle,
      club: display.club,
      members: display.members,
      matches: display.matches,
      player: display.player,
    });
  }

  const writeProduct = writesToProductLedger(liveTitle);
  const mine = writeProduct
    ? buildVerifiedStatsForPlayer(
        matches,
        profile.username,
        profile.verified_stats,
        eaProvider.name,
        confirmed.externalId,
        confirmed.externalPlatform,
        new Date().toISOString(),
        liveTitle
      )
    : null;

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
    synced: Boolean(mine),
    stats: mine,
    liveTitle,
    productTitle: PRODUCT_EA_TITLE,
    ingested: ingestMeta,
    eaTitle: display.eaTitle,
    club: display.club,
    members: display.members,
    matches: display.matches,
    player: display.player,
  });
});

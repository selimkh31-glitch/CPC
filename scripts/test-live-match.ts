/**
 * Tests de lib/liveMatch.ts — matching LIVE déterministe
 * (poste + plateforme + expiry + besoin club). Pas d'égalité username.
 *
 * Lancer : npx tsx scripts/test-live-match.ts
 */
import { canApplyToLiveClub, isPlayerCompatibleWithClubNeed, matchLivePlayerToClub, rankLiveClubsForPlayer } from "../lib/liveMatch";

const NOW = Date.parse("2026-08-24T12:00:00.000Z");

const player = {
  mainPosition: "ST",
  secondaryPositions: ["CAM"],
  platform: "PS",
};

const liveClub = {
  clubId: "c1",
  sessionId: "s1",
  is_live: true,
  expires_at: "2026-08-24T14:00:00.000Z",
  neededPositions: ["ST", "CB"],
  platform: "PS",
};

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
    }
  },
  true(v: unknown, label: string) {
    if (!v) throw new Error(`Assertion échouée (${label}) attendu truthy`);
  },
  false(v: unknown, label: string) {
    if (v) throw new Error(`Assertion échouée (${label}) attendu falsy`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

console.log("lib/liveMatch.ts — matching LIVE déterministe");

test("match — poste principal + même plateforme + LIVE actif → eligible 100", () => {
  const r = matchLivePlayerToClub(player, liveClub, NOW);
  assert.true(r.eligible, "eligible");
  assert.equal(r.score, 100, "score");
  assert.true(r.reasons.some((x) => x.includes("ST")), "reason poste");
  assert.true(r.reasons.some((x) => x.includes("PS")), "reason plateforme");
});

test("match — poste secondaire seulement → eligible, score 80", () => {
  const r = matchLivePlayerToClub(player, { ...liveClub, neededPositions: ["CAM"] }, NOW);
  assert.true(r.eligible, "eligible");
  assert.equal(r.score, 80, "score");
});

test("refus — LIVE expiré même si poste et plateforme OK", () => {
  const r = matchLivePlayerToClub(
    player,
    { ...liveClub, expires_at: "2026-08-24T11:00:00.000Z" },
    NOW
  );
  assert.false(r.eligible, "not eligible");
  assert.equal(r.score, 0, "score");
  assert.true(r.blockers.some((b) => b.includes("expiré")), "blocker expiry");
});

test("refus — is_live false", () => {
  const r = matchLivePlayerToClub(player, { ...liveClub, is_live: false }, NOW);
  assert.false(r.eligible, "not eligible");
});

test("refus — plateforme différente (pas d'égalité username, critère platform)", () => {
  const r = matchLivePlayerToClub(player, { ...liveClub, platform: "PC" }, NOW);
  assert.false(r.eligible, "not eligible");
  assert.true(r.blockers.some((b) => b.includes("plateforme")), "blocker platform");
});

test("refus — plateforme owner inconnue", () => {
  const r = matchLivePlayerToClub(player, { ...liveClub, platform: null }, NOW);
  assert.false(r.eligible, "not eligible");
});

test("refus — poste hors besoin du club", () => {
  const r = matchLivePlayerToClub(player, { ...liveClub, neededPositions: ["GK"] }, NOW);
  assert.false(r.eligible, "not eligible");
  assert.true(r.blockers.some((b) => b.includes("poste")), "blocker position");
});

test("refus — needed_positions vide (pas de club need)", () => {
  const r = matchLivePlayerToClub(player, { ...liveClub, neededPositions: [] }, NOW);
  assert.false(r.eligible, "not eligible");
});

test("rank — n'inclut que les eligible, trié par score desc", () => {
  const ranked = rankLiveClubsForPlayer(
    player,
    [
      { ...liveClub, clubId: "expired", expires_at: "2026-08-24T11:00:00.000Z" },
      { ...liveClub, clubId: "secondary", neededPositions: ["CAM"], sessionId: "s2" },
      { ...liveClub, clubId: "main", sessionId: "s3" },
      { ...liveClub, clubId: "xbox", platform: "XBOX", sessionId: "s4" },
    ],
    NOW
  );
  assert.equal(ranked.map((r) => r.clubId).join(","), "main,secondary", "order");
  assert.equal(ranked[0].score, 100, "main first");
  assert.equal(ranked[1].score, 80, "secondary second");
});

test("isPlayerCompatibleWithClubNeed — true seulement si les 4 critères tiennent", () => {
  assert.true(isPlayerCompatibleWithClubNeed(player, liveClub, NOW), "ok");
  assert.false(isPlayerCompatibleWithClubNeed(player, { ...liveClub, platform: "PC" }, NOW), "platform");
});

test("canApplyToLiveClub — OK si matching + poste visé joué et recherché", () => {
  const r = canApplyToLiveClub(player, liveClub, "ST", NOW);
  assert.true(r.ok, "ok");
});

test("canApplyToLiveClub — refuse poste recherché mais pas joué par le joueur", () => {
  const r = canApplyToLiveClub(player, liveClub, "CB", NOW);
  assert.false(r.ok, "not ok");
});

test("canApplyToLiveClub — refuse plateforme différente", () => {
  const r = canApplyToLiveClub(player, { ...liveClub, platform: "PC" }, "ST", NOW);
  assert.false(r.ok, "not ok");
});

test("canApplyToLiveClub — refuse LIVE expiré", () => {
  const r = canApplyToLiveClub(player, { ...liveClub, expires_at: "2026-08-24T11:00:00.000Z" }, "ST", NOW);
  assert.false(r.ok, "not ok");
});

test("aucun username n'entre dans le score (régression anti égalité EA)", () => {
  const a = matchLivePlayerToClub(player, liveClub, NOW);
  const b = matchLivePlayerToClub({ ...player }, liveClub, NOW);
  assert.equal(a.score, b.score, "username-agnostic");
  assert.false(JSON.stringify(a).toLowerCase().includes("username"), "no username in result");
});

console.log(`\n${passed} tests live-match OK`);

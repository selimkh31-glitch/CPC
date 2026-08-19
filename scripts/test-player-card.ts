/**
 * Tests de lib/playerCard.ts (buildPlayerCardData) — normalizer central de
 * la PlayerCard (mission "PLAYER CARDS FAÇON FUT", section 8 : "Ajouter des
 * tests pour les cas limites : données null, données absentes, joueur sans
 * match, stats partielles, rating absent"). Logique pure, aucune dépendance
 * réseau/Supabase.
 *
 * Lancer : npx tsx scripts/test-player-card.ts
 */
import { buildPlayerCardData } from "../lib/playerCard";
import { computeOvr, rarityForOvr } from "../lib/ovr";
import type { UserRow } from "../lib/types";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
  },
  deepEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée (${label}).\n  reçu: ${a}\n  attendu: ${b}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

/** UserRow minimal exploitable — chaque test override seulement les champs pertinents. */
function baseUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "u1",
    username: "Selim",
    platform: "PS",
    main_position: "ST",
    secondary_positions: [],
    play_style: "ATTACKING",
    languages: ["FR"],
    availability: {},
    reliability_score: 50,
    verified_stats: null,
    ea_club_linked: null,
    plan: "FREE",
    current_streak: 0,
    best_streak: 0,
    badges: [],
    applications_today: 0,
    applications_reset_at: new Date().toISOString(),
    push_token: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

console.log("lib/playerCard.ts — buildPlayerCardData");

test("joueur sans club EA lié -> verified=false, eaStats=null (jamais affiché comme vérifié)", () => {
  const data = buildPlayerCardData(baseUser({ ea_club_linked: null, verified_stats: null }));
  assert.equal(data.verified, false, "verified");
  assert.equal(data.eaStats, null, "eaStats");
});

test("joueur avec club EA lié -> verified=true, eaStats reflète verified_stats tel quel", () => {
  const stats = { goals: 3, assists: 1, matchesPlayed: 5 };
  const data = buildPlayerCardData(baseUser({ ea_club_linked: "12345", verified_stats: stats }));
  assert.equal(data.verified, true, "verified");
  assert.deepEqual(data.eaStats, stats, "eaStats");
});

test("ovr/rarity dérivés exactement de computeOvr/rarityForOvr (aucun recalcul divergent)", () => {
  const user = baseUser({ reliability_score: 72, verified_stats: { goals: 2, matchesPlayed: 4, avgRating: 7.5 } });
  const data = buildPlayerCardData(user);
  const expectedOvr = computeOvr({ reliabilityScore: 72, verifiedStats: { goals: 2, matchesPlayed: 4, avgRating: 7.5 } });
  assert.equal(data.ovr, expectedOvr, "ovr");
  assert.equal(data.rarity, rarityForOvr(expectedOvr), "rarity");
});

test("currentStreak/badges/secondaryPositions absents (undefined via cast) -> tableaux/0 vides, jamais undefined/crash", () => {
  // Simule une ligne partiellement hydratée (ex. select() ciblé côté appelant) —
  // buildPlayerCardData ne doit jamais planter ni propager `undefined`.
  const partial = baseUser();
  // @ts-expect-error — on force volontairement des champs absents pour tester la défense.
  delete partial.current_streak;
  // @ts-expect-error
  delete partial.badges;
  // @ts-expect-error
  delete partial.secondary_positions;

  const data = buildPlayerCardData(partial);
  assert.equal(data.currentStreak, 0, "currentStreak");
  assert.deepEqual(data.badges, [], "badges");
  assert.deepEqual(data.secondaryPositions, [], "secondaryPositions");
});

test("clubName absent par défaut -> null (jamais une chaîne vide silencieuse)", () => {
  const data = buildPlayerCardData(baseUser());
  assert.equal(data.clubName, null, "clubName");
});

test("clubName fourni explicitement -> reflété tel quel", () => {
  const data = buildPlayerCardData(baseUser(), { clubName: "Les Invincibles" });
  assert.equal(data.clubName, "Les Invincibles", "clubName");
});

test("verified_stats avec champs partiels (rating/matchesPlayed absents) -> ne casse pas l'OVR (reste dans [40,99])", () => {
  const data = buildPlayerCardData(baseUser({ reliability_score: 50, verified_stats: { goals: 1 } }));
  if (data.ovr < 40 || data.ovr > 99) throw new Error(`OVR hors bornes : ${data.ovr}`);
});

console.log(`\n${passed} test(s) passés.`);

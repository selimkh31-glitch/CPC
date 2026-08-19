/**
 * Tests de supabase/functions/_shared/reliability.ts (computeReliabilityScore)
 * — Trust Engine, source de vérité unique (voir en-tête du fichier). Logique
 * pure, jamais testée jusqu'ici malgré son rôle central (classement des
 * candidatures, ClubPro Card, PlayerCard). Identifié comme test à forte
 * valeur lors de l'audit post-session (mission "PHASE 9 — TESTS MANQUANTS").
 *
 * Lancer : npx tsx scripts/test-reliability.ts
 */
import { computeReliabilityScore } from "../supabase/functions/_shared/reliability";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`Assertion échouée (${label}).\n  reçu: ${actual}\n  attendu: ${expected}`);
  },
  inRange(actual: number, min: number, max: number, label: string) {
    if (actual < min || actual > max) throw new Error(`Assertion échouée (${label}) : ${actual} hors de [${min}, ${max}].`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

console.log("_shared/reliability.ts — computeReliabilityScore");

test("aucune review, aucun streak, aucune stat vérifiée -> 0 exact (nouveau joueur)", () => {
  const score = computeReliabilityScore({ reviews: [], currentStreak: 0, verifiedStats: null });
  assert.equal(score, 0, "score");
});

test("reviews parfaites (5/5 partout), rien d'autre -> 100", () => {
  const score = computeReliabilityScore({
    reviews: [{ ratingSkill: 5, ratingBehavior: 5, showedUp: true }],
    currentStreak: 0,
    verifiedStats: null,
  });
  assert.equal(score, 100, "score");
});

test("reviews minimales (1/1 partout) -> 20 (jamais 0 tant qu'il y a au moins une review)", () => {
  const score = computeReliabilityScore({
    reviews: [{ ratingSkill: 1, ratingBehavior: 1, showedUp: false }],
    currentStreak: 0,
    verifiedStats: null,
  });
  assert.equal(score, 20, "score");
});

test("aucune review mais streak > 0 -> base neutre (3/5) + bonus streak, jamais 0", () => {
  // base = (3*0.6 + 3*0.4) * 20 = 60 ; streakBonus = min(5*0.4, 8) = 2 -> 62
  const score = computeReliabilityScore({ reviews: [], currentStreak: 5, verifiedStats: null });
  assert.equal(score, 62, "score");
});

test("bonus de streak plafonné (STREAK_BONUS_CAP=8) même avec un streak énorme", () => {
  const score = computeReliabilityScore({ reviews: [], currentStreak: 1000, verifiedStats: null });
  // base neutre 60 + plafond 8 = 68, jamais 60 + 1000*0.4
  assert.equal(score, 68, "score plafonné");
});

test("bonus EA plafonné (EA_BONUS_CAP=6) même sans aucun no-show détecté", () => {
  const score = computeReliabilityScore({
    reviews: [],
    currentStreak: 0,
    verifiedStats: { matchesPlayedRecent: 10, noShowsDetected: 0 },
  });
  // base neutre 60 + eaBonus plein (showRatio=1 -> 6) = 66
  assert.equal(score, 66, "score");
});

test("no-shows détectés réduisent le bonus EA proportionnellement, jamais sous 0", () => {
  const score = computeReliabilityScore({
    reviews: [],
    currentStreak: 0,
    verifiedStats: { matchesPlayedRecent: 1, noShowsDetected: 10 },
  });
  // showRatio = max(0, 1 - 10/11) ≈ 0.0909 -> eaBonus ≈ 0.545 -> jamais négatif
  assert.inRange(score, 60, 61, "score reste proche de la base, jamais < base");
});

test("score final toujours borné [0, 100] même en cumulant tous les bonus", () => {
  const score = computeReliabilityScore({
    reviews: [{ ratingSkill: 5, ratingBehavior: 5, showedUp: true }],
    currentStreak: 1000,
    verifiedStats: { matchesPlayedRecent: 50, noShowsDetected: 0 },
  });
  // base 100 + streak 8 (plafond) + ea 6 (plafond) = 114 avant clamp
  assert.equal(score, 100, "clampé à 100, jamais 114");
});

console.log(`\n${passed} test(s) passés.`);

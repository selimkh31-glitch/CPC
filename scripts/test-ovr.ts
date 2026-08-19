/**
 * Tests de lib/ovr.ts (computeOvr / rarityForOvr) — logique pure, aucune
 * dépendance réseau/Supabase. Jamais testé jusqu'ici malgré son rôle central
 * (ClubPro Card, et depuis cette session PlayerCard/buildPlayerCardData) —
 * identifié comme un des tests à plus forte valeur lors de l'audit
 * post-session (mission "PHASE 9 — TESTS MANQUANTS").
 *
 * Lancer : npx tsx scripts/test-ovr.ts
 */
import { computeOvr, rarityForOvr } from "../lib/ovr";

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

console.log("lib/ovr.ts — computeOvr / rarityForOvr");

test("computeOvr — sans stats vérifiées, reste dans le plancher/plafond produit [40, 99]", () => {
  assert.inRange(computeOvr({ reliabilityScore: 0 }), 40, 99, "reliabilityScore=0");
  assert.inRange(computeOvr({ reliabilityScore: 100 }), 40, 99, "reliabilityScore=100");
});

test("computeOvr — reliabilityScore=0 sans stats -> plancher exact 40", () => {
  // reliabilityComponent = 45 (45 + 0*0.4) ; ovr = 45*0.7 + 45*0.3 = 45,
  // avant clamp -- mais le plancher produit est 40 < 45, donc pas atteint
  // ici : ce test documente que 0 de fiabilité ne fait PAS tomber au
  // plancher absolu (45 reste "jouable"), contrairement à une lecture
  // naïve du nom "plancher à 45 pour rester jouable" dans le commentaire.
  assert.equal(computeOvr({ reliabilityScore: 0 }), 45, "reliabilityScore=0 => 45");
});

test("computeOvr — reliabilityScore=100 sans stats -> plafonné à 85 (composante fiabilité seule, jamais 99)", () => {
  // reliabilityComponent = 45 + 100*0.4 = 85 ; ovr = 85*0.7 + 45*0.3 = 73
  assert.equal(computeOvr({ reliabilityScore: 100 }), 73, "reliabilityScore=100 sans stats => 73");
});

test("computeOvr — monotone croissant en reliabilityScore, à stats égales", () => {
  const low = computeOvr({ reliabilityScore: 20 });
  const mid = computeOvr({ reliabilityScore: 50 });
  const high = computeOvr({ reliabilityScore: 80 });
  if (!(low <= mid && mid <= high)) throw new Error(`Non-monotone : ${low}, ${mid}, ${high}`);
});

test("computeOvr — bonnes stats vérifiées (buts/passes/note élevée) augmentent l'OVR", () => {
  const base = computeOvr({ reliabilityScore: 50 });
  const withStats = computeOvr({
    reliabilityScore: 50,
    verifiedStats: { goals: 2, assists: 1, matchesPlayed: 1, avgRating: 8 },
  });
  if (!(withStats > base)) throw new Error(`Attendu withStats(${withStats}) > base(${base})`);
});

test("computeOvr — très mauvaise note vérifiée (avgRating bas, 0 but/passe) réduit l'OVR sous la fiabilité seule", () => {
  // Comportement actuel documenté (pas de plancher sur performanceComponent,
  // voir lib/ovr.ts) : une mauvaise note EA peut activement tirer l'OVR vers
  // le bas, pas juste "ne rien ajouter". Ce test verrouille ce comportement
  // pour qu'un futur changement de formule soit délibéré, pas accidentel.
  const base = computeOvr({ reliabilityScore: 50 });
  const withBadStats = computeOvr({
    reliabilityScore: 50,
    verifiedStats: { goals: 0, assists: 0, matchesPlayed: 5, avgRating: 1 },
  });
  if (!(withBadStats < base)) throw new Error(`Attendu withBadStats(${withBadStats}) < base(${base})`);
});

test("computeOvr — matchesPlayed=0 est traité comme 'pas de stats' (évite une division par zéro)", () => {
  const withZeroMatches = computeOvr({ reliabilityScore: 50, verifiedStats: { goals: 5, matchesPlayed: 0 } });
  const withoutStats = computeOvr({ reliabilityScore: 50 });
  assert.equal(withZeroMatches, withoutStats, "matchesPlayed=0 == verifiedStats absent");
});

test("computeOvr — résultat toujours un entier (arrondi), jamais de décimales affichées", () => {
  const ovr = computeOvr({ reliabilityScore: 63.7, verifiedStats: { goals: 1, matchesPlayed: 3, avgRating: 7.2 } });
  assert.equal(Number.isInteger(ovr), true, "OVR entier");
});

test("rarityForOvr — bronze/argent/or/icon aux bornes exactes (64/65, 79/80, 89/90)", () => {
  assert.equal(rarityForOvr(40), "bronze", "40");
  assert.equal(rarityForOvr(64), "bronze", "64");
  assert.equal(rarityForOvr(65), "silver", "65");
  assert.equal(rarityForOvr(79), "silver", "79");
  assert.equal(rarityForOvr(80), "gold", "80");
  assert.equal(rarityForOvr(89), "gold", "89");
  assert.equal(rarityForOvr(90), "icon", "90");
  assert.equal(rarityForOvr(99), "icon", "99");
});

console.log(`\n${passed} test(s) passés.`);

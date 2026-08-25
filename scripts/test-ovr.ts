/**
 * Tests de lib/ovr.ts — OVR CPC honnête (fiabilité CPC seulement).
 * Lancer : npx tsx scripts/test-ovr.ts
 */
import { canShowOvrCpc, computeOvr, rarityForOvr, OVR_CPC_LABEL } from "../lib/ovr";

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

test("libellé unique OVR CPC — jamais un bare OVR", () => {
  assert.equal(OVR_CPC_LABEL, "OVR CPC", "label");
});

test("canShowOvrCpc — score 0 / absent / NaN = pas assez de signal CPC", () => {
  assert.equal(canShowOvrCpc(0), false, "0");
  assert.equal(canShowOvrCpc(null), false, "null");
  assert.equal(canShowOvrCpc(undefined), false, "undefined");
  assert.equal(canShowOvrCpc(Number.NaN), false, "NaN");
  assert.equal(canShowOvrCpc(1), true, "1");
  assert.equal(canShowOvrCpc(50), true, "50");
});

test("computeOvr — reliabilityScore=0 -> null (pas de 45 décoratif)", () => {
  assert.equal(computeOvr({ reliabilityScore: 0 }), null, "0 => null");
});

test("computeOvr — reliabilityScore stocké > 0 = arrondi transparent, borné 1-99", () => {
  assert.equal(computeOvr({ reliabilityScore: 50 }), 50, "50");
  assert.equal(computeOvr({ reliabilityScore: 100 }), 99, "100 clamp 99");
  assert.equal(computeOvr({ reliabilityScore: 20.4 }), 20, "arrondi");
  assert.equal(computeOvr({ reliabilityScore: 72.6 }), 73, "arrondi up");
});

test("computeOvr — monotone croissant en reliabilityScore (quand affiché)", () => {
  const low = computeOvr({ reliabilityScore: 20 });
  const mid = computeOvr({ reliabilityScore: 50 });
  const high = computeOvr({ reliabilityScore: 80 });
  if (low === null || mid === null || high === null) throw new Error("attendu des nombres");
  if (!(low <= mid && mid <= high)) throw new Error(`Non-monotone : ${low}, ${mid}, ${high}`);
});

test("computeOvr — stats EA (buts/passes/note) N'augmentent PAS l'OVR CPC", () => {
  const base = computeOvr({ reliabilityScore: 50 });
  const withStats = computeOvr({
    reliabilityScore: 50,
    verifiedStats: { goals: 99, assists: 99, matchesPlayed: 1, avgRating: 10 },
  });
  assert.equal(withStats, base, "EA ignoré");
  assert.equal(withStats, 50, "reste 50");
});

test("computeOvr — mauvaise note EA ne réduit pas non plus l'OVR CPC", () => {
  const base = computeOvr({ reliabilityScore: 50 });
  const withBadStats = computeOvr({
    reliabilityScore: 50,
    verifiedStats: { goals: 0, assists: 0, matchesPlayed: 5, avgRating: 1 },
  });
  assert.equal(withBadStats, base, "EA ignoré même mauvais");
});

test("computeOvr — matchesPlayed EA=0 n'invente rien et n'égale pas un plancher 45", () => {
  const withZeroMatches = computeOvr({ reliabilityScore: 50, verifiedStats: { goals: 5, matchesPlayed: 0 } });
  const withoutStats = computeOvr({ reliabilityScore: 50 });
  assert.equal(withZeroMatches, withoutStats, "identique");
});

test("computeOvr — résultat affiché toujours un entier", () => {
  const ovr = computeOvr({ reliabilityScore: 63.7, verifiedStats: { goals: 1, matchesPlayed: 3, avgRating: 7.2 } });
  assert.equal(ovr, 64, "arrondi");
  assert.equal(Number.isInteger(ovr), true, "entier");
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

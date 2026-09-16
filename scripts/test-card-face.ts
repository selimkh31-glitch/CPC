/**
 * Tests de lib/cardFace.ts — pack EA réel vs overlay DEV.
 * Lancer : npx tsx scripts/test-card-face.ts
 */
import {
  FACE_STAT_KEYS,
  buildDevFaceStats,
  faceStatsCaption,
  parseFaceAttr,
  readStoredFaceStats,
  resolveFaceStats,
  visibleFaceStatCells,
} from "../lib/cardFace";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
    }
  },
  true(actual: unknown, label: string) {
    if (actual !== true) throw new Error(`Assertion échouée (${label}) : attendu true, reçu ${actual}`);
  },
  false(actual: unknown, label: string) {
    if (actual !== false) throw new Error(`Assertion échouée (${label}) : attendu false, reçu ${actual}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

console.log("lib/cardFace.ts");

test("FACE_STAT_KEYS — 6 attributs FIFA, ordre PAC/SHO/PAS/DRI/DEF/PHY", () => {
  assert.equal(FACE_STAT_KEYS.join(","), "pac,sho,pas,dri,def,phy", "keys");
});

test("parseFaceAttr — 0–99 finis seulement", () => {
  assert.equal(parseFaceAttr(87), 87, "int");
  assert.equal(parseFaceAttr(87.4), 87, "round");
  assert.equal(parseFaceAttr(0), 0, "zero ok");
  assert.equal(parseFaceAttr(99), 99, "99");
  assert.equal(parseFaceAttr(100), null, "100");
  assert.equal(parseFaceAttr(-1), null, "neg");
  assert.equal(parseFaceAttr(NaN), null, "nan");
  assert.equal(parseFaceAttr("82"), null, "string");
  assert.equal(parseFaceAttr(undefined), null, "undef");
});

test("readStoredFaceStats — pack incomplet, jamais de pad, ignore career", () => {
  assert.equal(readStoredFaceStats(null), null, "null");
  assert.equal(readStoredFaceStats({}), null, "empty");
  assert.equal(readStoredFaceStats({ goals: 12, assists: 4 }), null, "career only");
  const partial = readStoredFaceStats({ sho: 88, pac: 100, def: -2, pas: 71 });
  assert.equal(partial?.sho, 88, "sho");
  assert.equal(partial?.pas, 71, "pas");
  assert.equal(partial?.pac, undefined, "100 dropped");
  assert.equal(partial?.def, undefined, "neg dropped");
  assert.equal(Object.keys(partial ?? {}).length, 2, "only real");
});

test("prod isDev false sans attrs → null", () => {
  const pack = resolveFaceStats({
    verified: { goals: 3 },
    identityKind: "NONE",
    isDev: false,
    seed: "u1",
    position: "ST",
  });
  assert.equal(pack, null, "null");
});

test("USERNAME_EQUALITY sans face attrs + prod → null", () => {
  const pack = resolveFaceStats({
    verified: { goals: 9, assists: 2 },
    identityKind: "USERNAME_EQUALITY",
    isDev: false,
    seed: "u1",
    position: "ST",
  });
  assert.equal(pack, null, "career is not face");
});

test("DEV sans attrs → source DEV, 6 clés, déterministe", () => {
  const a = resolveFaceStats({
    verified: null,
    identityKind: "NONE",
    isDev: true,
    seed: "selim-1",
    position: "ST",
  });
  const b = resolveFaceStats({
    verified: null,
    identityKind: "NONE",
    isDev: true,
    seed: "selim-1",
    position: "ST",
  });
  assert.equal(a?.source, "DEV", "source");
  assert.equal(FACE_STAT_KEYS.every((k) => typeof a?.values[k] === "number"), true, "six");
  assert.equal(JSON.stringify(a?.values), JSON.stringify(b?.values), "stable");
  assert.equal(faceStatsCaption("DEV"), "DEV — pas des stats EA", "dev caption");
  assert.equal(faceStatsCaption("DEV") === "EA (club lié)", false, "not labelled EA");
});

test("ST SHO high, GK SHO low — même seed", () => {
  const st = buildDevFaceStats("seed-x", "ST");
  const gk = buildDevFaceStats("seed-x", "GK");
  assert.true(st.sho >= 78, "ST SHO high");
  assert.true(gk.sho <= 38, "GK SHO low");
  assert.true(st.sho > gk.sho, "ST > GK");
});

test("attrs + USERNAME_EQUALITY même isDev true → EA, jamais mix DEV", () => {
  const pack = resolveFaceStats({
    verified: { sho: 91, pac: 80, goals: 12 },
    identityKind: "USERNAME_EQUALITY",
    isDev: true,
    seed: "u1",
    position: "ST",
  });
  assert.equal(pack?.source, "EA", "EA wins");
  assert.equal(pack?.values.sho, 91, "stored sho");
  assert.equal(pack?.values.pac, 80, "stored pac");
  assert.equal(pack?.values.pas, undefined, "no DEV pad");
  assert.equal(pack?.values.dri, undefined, "no DRI pad");
  assert.equal(visibleFaceStatCells(pack).length, 2, "two cells");
  assert.equal(faceStatsCaption("EA"), "EA (club lié)", "ea caption");
});

test("face attrs sans USERNAME_EQUALITY → pas EA ; DEV si isDev", () => {
  const stored = { pac: 99, sho: 99 };
  const prod = resolveFaceStats({
    verified: stored,
    identityKind: "NONE",
    isDev: false,
    seed: "u1",
    position: "ST",
  });
  assert.equal(prod, null, "prod ignores unverified");
  const dev = resolveFaceStats({
    verified: stored,
    identityKind: "NONE",
    isDev: true,
    seed: "u1",
    position: "ST",
  });
  assert.equal(dev?.source, "DEV", "dev overlay");
  assert.equal(dev?.values.pac === 99, false, "not the stored 99");
});

console.log(`\n${passed} tests card-face OK`);

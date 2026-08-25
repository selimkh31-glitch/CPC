/**
 * Tests de lib/liveFilters.ts — élargissement UI du feed LIVE joueur.
 * Ne touche pas au moteur de matching (lib/liveMatch.ts).
 *
 * Lancer : npx tsx scripts/test-live-filters.ts
 */
import {
  EMPTY_LIVE_FILTERS,
  canWidenLiveFilters,
  clubSessionMatchesLiveFilters,
  liveFiltersAreEmpty,
  widenLiveFilters,
} from "../lib/liveFilters";

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

console.log("lib/liveFilters.ts — filtres UI LIVE");

test("vide au départ", () => {
  assert.true(liveFiltersAreEmpty(EMPTY_LIVE_FILTERS), "empty");
  assert.false(canWidenLiveFilters(EMPTY_LIVE_FILTERS), "cannot widen empty");
});

test("élargir enlève langue, puis niveau, puis plateforme, puis poste", () => {
  const start = { position: "ST", platform: "PS", level: "CASUAL", language: "FR" };
  const a = widenLiveFilters(start);
  assert.equal(a.language, "", "clears language first");
  assert.equal(a.position, "ST", "keeps position");
  const b = widenLiveFilters(a);
  assert.equal(b.level, "", "clears level next");
  const c = widenLiveFilters(b);
  assert.equal(c.platform, "", "clears platform next");
  const d = widenLiveFilters(c);
  assert.equal(d.position, "", "clears position last");
  assert.true(liveFiltersAreEmpty(d), "empty after full widen");
  const e = widenLiveFilters(d);
  assert.equal(e.position, "", "idempotent when already empty");
});

const liveClub = {
  needed_positions: ["ST", "CAM"],
  club: {
    level: "CASUAL",
    languages: ["FR", "EN"],
    owner: { platform: "PS" },
  },
};

test("filtre poste — besoin club", () => {
  assert.true(clubSessionMatchesLiveFilters(liveClub, EMPTY_LIVE_FILTERS), "no filter");
  assert.true(clubSessionMatchesLiveFilters(liveClub, { ...EMPTY_LIVE_FILTERS, position: "ST" }), "ST needed");
  assert.false(clubSessionMatchesLiveFilters(liveClub, { ...EMPTY_LIVE_FILTERS, position: "GK" }), "GK not needed");
});

test("filtre plateforme owner", () => {
  assert.true(clubSessionMatchesLiveFilters(liveClub, { ...EMPTY_LIVE_FILTERS, platform: "PS" }), "PS");
  assert.false(clubSessionMatchesLiveFilters(liveClub, { ...EMPTY_LIVE_FILTERS, platform: "PC" }), "PC");
});

test("filtre niveau + langue existants", () => {
  assert.true(clubSessionMatchesLiveFilters(liveClub, { ...EMPTY_LIVE_FILTERS, level: "CASUAL" }), "casual");
  assert.false(clubSessionMatchesLiveFilters(liveClub, { ...EMPTY_LIVE_FILTERS, level: "COMPETITIVE" }), "comp");
  assert.true(clubSessionMatchesLiveFilters(liveClub, { ...EMPTY_LIVE_FILTERS, language: "FR" }), "FR");
  assert.false(clubSessionMatchesLiveFilters(liveClub, { ...EMPTY_LIVE_FILTERS, language: "DE" }), "DE");
});

test("pas de club / pas de postes → rejeté", () => {
  assert.false(clubSessionMatchesLiveFilters({ needed_positions: ["ST"], club: null }, EMPTY_LIVE_FILTERS), "no club");
  assert.false(
    clubSessionMatchesLiveFilters({ needed_positions: [], club: liveClub.club }, EMPTY_LIVE_FILTERS),
    "no positions"
  );
});

console.log(`\n${passed} tests OK`);

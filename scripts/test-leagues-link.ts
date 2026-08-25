/**
 * Tests de LeaguesLink — pousse `/leagues`, pas un 4e onglet.
 * Sans réseau / sans Expo. Lancer : npx tsx scripts/test-leagues-link.ts
 */
import {
  LEAGUES_STACK_HREF,
  LEAGUES_TAB_HREF,
  pushLeaguesScreen,
} from "../lib/leagues";
import { RANKING_COPY } from "../lib/rankings";

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

console.log("LeaguesLink → /leagues");

test("LeaguesLink pousse /leagues (pushLeaguesScreen)", () => {
  const calls: string[] = [];
  pushLeaguesScreen((href) => {
    calls.push(href);
  });
  assert.equal(LEAGUES_STACK_HREF, "/leagues", "const");
  assert.equal(calls.length, 1, "one push");
  assert.equal(calls[0], "/leagues", "href");
});

test("libellé FR classement clubs CPC, pas une ligue EA", () => {
  assert.equal(RANKING_COPY.clubTitle, "Classement clubs CPC", "title");
  assert.false(RANKING_COPY.clubTitle.toLowerCase().includes("ligue ea"), "not ligue ea");
  assert.true(RANKING_COPY.clubSubtitle.includes("adversaire"), "opponent only");
});

test("Ligues reste hors tab bar (href: null)", () => {
  assert.equal(LEAGUES_TAB_HREF, null, "tab href");
  assert.equal(LEAGUES_STACK_HREF, "/leagues", "stack still /leagues");
});

console.log(`\n${passed} tests OK`);

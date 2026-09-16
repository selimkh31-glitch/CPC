/**
 * Tests de LeaguesLink — pousse `/leagues`, pas un 4e onglet.
 * Sans réseau / sans Expo. Lancer : npx tsx scripts/test-leagues-link.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { existsSync, readFileSync } from "fs";
import {
  LEAGUES_STACK_HREF,
  LEAGUES_TAB_HREF,
  pushLeaguesScreen,
} from "../lib/leagues";
import { RANKING_COPY } from "../lib/rankings";

const root = process.cwd();

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

test("push /leagues cible le stack partagé (app/leagues.tsx + _layout), sans tab Redirect collision", () => {
  const stackFile = `${root}/app/leagues.tsx`;
  assert.true(existsSync(stackFile), "app/leagues.tsx");
  assert.false(existsSync(`${root}/app/(player)/(tabs)/leagues.tsx`), "no tab collision");
  const layout = readFileSync(`${root}/app/_layout.tsx`, "utf8");
  const sharedGuard = layout.indexOf("Stack.Protected guard={Boolean(session) && Boolean(profile) && Boolean(mode)}>");
  const playerGuard = layout.indexOf('mode === "PLAYER"');
  const leaguesName = layout.indexOf('name="leagues"');
  assert.true(sharedGuard >= 0, "shared guard");
  assert.true(leaguesName > sharedGuard, "registered next to competitions");
  assert.true(playerGuard >= 0 && leaguesName > playerGuard, "not only player tree");
  assert.true(layout.includes('name="competitions/index"'), "competitions sibling");
  assert.true(layout.includes('name="tournaments/index"'), "tournaments sibling");
  const leaguesBlock = layout.slice(leaguesName, leaguesName + 280);
  assert.true(leaguesBlock.includes("headerShown: true"), "headerShown");
  assert.true(
    leaguesBlock.includes("RANKING_COPY.clubTitle") || leaguesBlock.includes('"Ligues"'),
    "title"
  );
  assert.true(readFileSync(stackFile, "utf8").includes("CpcClubRanking"), "stack has CPC table");
  const tabsLayout = readFileSync(`${root}/app/(player)/(tabs)/_layout.tsx`, "utf8");
  assert.false(tabsLayout.includes('name="leagues"'), "Ligues pas un onglet");
});

console.log(`\n${passed} tests OK`);

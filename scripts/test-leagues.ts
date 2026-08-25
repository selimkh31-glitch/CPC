/**
 * Tests de lib/leagues.ts — pas de classement inventé sur `/leagues`.
 * Sans réseau. Lancer : npx tsx scripts/test-leagues.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { existsSync, readFileSync } from "fs";
import {
  canShowLiveLeagueRanking,
  LEAGUE_COPY,
  LEAGUES_STACK_HREF,
  LEAGUES_TAB_HREF,
  SEASON_STATS_WRITTEN_FROM_MATCH_RESULTS,
} from "../lib/leagues";
import { canFillStandingsFromMatchResults } from "../lib/competitions";

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

console.log("lib/leagues.ts");

test("pas de classement live par défaut (season_stats ≠ match_results)", () => {
  assert.false(SEASON_STATS_WRITTEN_FROM_MATCH_RESULTS, "flag");
  assert.false(canShowLiveLeagueRanking(), "default");
  assert.true(canFillStandingsFromMatchResults(), "0027 columns exist");
  assert.false(
    canFillStandingsFromMatchResults(["id", "club_id", "our_score", "opponent_score", "outcome"]),
    "0014 columns still insufficient"
  );
});

test("colonnes 0014 seules ne suffisent pas ; pas de shortcut seed/EA", () => {
  assert.false(
    canShowLiveLeagueRanking({
      matchResultsColumns: ["id", "club_id", "our_score", "opponent_score", "outcome", "mvp_user_id"],
    }),
    "engine only"
  );
  assert.false(
    canShowLiveLeagueRanking({
      matchResultsColumns: ["competition_id", "opponent_club_id", "outcome"],
      seasonStatsWrittenFromMatchResults: false,
    }),
    "still not wired"
  );
});

test("futur : live ligues seulement si match_results liés ET agrégés dans season_stats", () => {
  assert.true(
    canShowLiveLeagueRanking({
      matchResultsColumns: ["competition_id", "opponent_club_id"],
      seasonStatsWrittenFromMatchResults: true,
    }),
    "both gates"
  );
});

test("copy FR honnête : classement saison vide (pas seed/EA), distinct du tableau CPC", () => {
  assert.equal(LEAGUE_COPY.title, "Ligues", "title");
  assert.true(LEAGUE_COPY.empty.includes("ligue saison"), "empty saison");
  assert.true(LEAGUE_COPY.empty.includes("résultats Pro Clubs"), "empty pro clubs");
  assert.true(LEAGUE_COPY.emptyHint.includes("inventés"), "hint no invent");
  assert.true(LEAGUE_COPY.emptyHint.includes("seed"), "hint seed");
  assert.false(LEAGUE_COPY.empty.includes("%"), "no percent empty");
  assert.false(LEAGUE_COPY.emptyHint.includes("%"), "no percent hint");
  assert.false(LEAGUE_COPY.empty.toLowerCase().includes("ovr"), "no ovr");
});

test("Ligues reste hors tab bar (href: null)", () => {
  assert.equal(LEAGUES_TAB_HREF, null, "href");
});

test("stack /leagues via LeaguesLink (pas un onglet)", () => {
  assert.equal(LEAGUES_STACK_HREF, "/leagues", "stack href");
});

test("stack /leagues enregistré dans l'arbre partagé — plus de collision avec un tab Redirect", () => {
  const stackFile = `${root}/app/leagues.tsx`;
  const layoutFile = `${root}/app/_layout.tsx`;
  const tabFile = `${root}/app/(player)/(tabs)/leagues.tsx`;
  const tabsLayoutFile = `${root}/app/(player)/(tabs)/_layout.tsx`;
  assert.true(existsSync(stackFile), "app/leagues.tsx");
  assert.true(existsSync(layoutFile), "app/_layout.tsx");
  assert.false(existsSync(tabFile), "no colliding player tab /leagues");

  const stack = readFileSync(stackFile, "utf8");
  const rankingPos = stack.indexOf("CpcClubRanking");
  const emptyPos = stack.indexOf("LEAGUE_COPY.empty");
  assert.true(rankingPos >= 0, "CpcClubRanking on stack screen");
  assert.true(emptyPos >= 0, "season empty copy");
  assert.true(rankingPos < emptyPos, "ranking leads, season empty secondary");
  assert.true(!stack.includes("<EmptyState"), "no full-screen EmptyState");
  assert.true(stack.includes("canShowLiveLeagueRanking"), "honest season gate");
  assert.true(stack.includes("clubRankingRowHref") || readFileSync(`${root}/components/rankings/CpcClubRanking.tsx`, "utf8").includes("clubRankingRowHref"), "row href helper");

  const layout = readFileSync(layoutFile, "utf8");
  const sharedGuard = layout.indexOf("Stack.Protected guard={Boolean(session) && Boolean(profile)}>");
  const leaguesName = layout.indexOf('name="leagues"');
  const competitionsName = layout.indexOf('name="competitions/index"');
  assert.true(sharedGuard >= 0, "shared guard");
  assert.true(leaguesName > sharedGuard, "leagues in shared tree");
  assert.true(competitionsName > sharedGuard, "competitions in shared tree");
  const leaguesBlock = layout.slice(leaguesName, leaguesName + 280);
  assert.true(leaguesBlock.includes("headerShown: true"), "back header");
  assert.true(
    leaguesBlock.includes("RANKING_COPY.clubTitle") || leaguesBlock.includes("Ligues"),
    "header title"
  );

  const tabsLayout = readFileSync(tabsLayoutFile, "utf8");
  assert.false(tabsLayout.includes('name="leagues"'), "no leagues tab screen");
  assert.true(tabsLayout.includes('name="index"'), "LIVE tab");
  assert.true(tabsLayout.includes('name="activity"'), "Activité tab");
  assert.true(tabsLayout.includes('name="profile"'), "Profil tab");
});

console.log(`\n${passed} tests OK`);

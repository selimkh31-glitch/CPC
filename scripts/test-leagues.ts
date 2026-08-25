/**
 * Tests de lib/leagues.ts — pas de classement inventé sur `/leagues`.
 * Sans réseau. Lancer : npx tsx scripts/test-leagues.ts
 */
import {
  canShowLiveLeagueRanking,
  LEAGUE_COPY,
  LEAGUES_TAB_HREF,
  SEASON_STATS_WRITTEN_FROM_MATCH_RESULTS,
} from "../lib/leagues";
import { canFillStandingsFromMatchResults } from "../lib/competitions";

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

test("copy FR honnête : pas de classement réel tant que non lié", () => {
  assert.equal(LEAGUE_COPY.title, "Ligues", "title");
  assert.true(LEAGUE_COPY.empty.includes("classement réel"), "empty ranking");
  assert.true(LEAGUE_COPY.empty.includes("résultats Pro Clubs"), "empty pro clubs");
  assert.true(LEAGUE_COPY.emptyHint.includes("inventés"), "hint no invent");
  assert.false(LEAGUE_COPY.empty.includes("%"), "no percent empty");
  assert.false(LEAGUE_COPY.emptyHint.includes("%"), "no percent hint");
  assert.false(LEAGUE_COPY.empty.toLowerCase().includes("ovr"), "no ovr");
});

test("Ligues reste hors tab bar (href: null)", () => {
  assert.equal(LEAGUES_TAB_HREF, null, "href");
});

console.log(`\n${passed} tests OK`);

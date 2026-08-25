/**
 * Tests de lib/rankings.ts — classement clubs CPC depuis match_results réels.
 * Sans réseau. Lancer : npx tsx scripts/test-rankings.ts
 */
import { COMPETITION_POINTS, computeCompetitionStandings } from "../lib/competitions";
import {
  CPC_PLAYER_RANKING_AVAILABLE,
  RANKING_COPY,
  canFillCpcClubRankingFromMatchResults,
  canFilterCpcRankingBySeason,
  canShowCpcClubRanking,
  canShowCpcPlayerRanking,
  clubRankingRowHref,
  computeCpcClubStandings,
  cpcClubRankingUsesSeasonStats,
  hasCpcClubRankingResults,
  isCpcClubRankingResult,
  matchResultsHasSeasonId,
} from "../lib/rankings";
import { PLAYER_MATCH_HISTORY_JOIN } from "../lib/matchHistory";
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";

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

console.log("lib/rankings.ts");

test("pas de season_id sur match_results → pas de filtre saison, libellé global CPC", () => {
  assert.false(matchResultsHasSeasonId(), "default columns");
  assert.false(canFilterCpcRankingBySeason(), "no season filter");
  assert.true(matchResultsHasSeasonId(["id", "season_id"]), "only if column exists");
  assert.true(canFilterCpcRankingBySeason(["opponent_club_id", "season_id"]), "future FK");
  assert.equal(RANKING_COPY.clubTitle, "Classement clubs CPC", "title");
  assert.true(RANKING_COPY.clubSubtitle.includes("pas une ligue EA"), "not EA league");
  assert.false(RANKING_COPY.clubTitle.toLowerCase().includes("ligue ea"), "title not ligue ea");
});

test("jamais season_stats / seed / ea-sync", () => {
  assert.false(cpcClubRankingUsesSeasonStats(), "no season_stats");
  assert.false(RANKING_COPY.clubEmpty.toLowerCase().includes("season_stats"), "no table name empty");
  assert.false(RANKING_COPY.clubSubtitle.toLowerCase().includes("ovr"), "no ovr");
});

test("colonnes : opponent_club_id suffit ; competition_id optionnel", () => {
  assert.true(canFillCpcClubRankingFromMatchResults(), "0027 default");
  assert.true(
    canFillCpcClubRankingFromMatchResults(["id", "club_id", "opponent_club_id", "outcome"]),
    "opponent only"
  );
  assert.false(
    canFillCpcClubRankingFromMatchResults(["id", "club_id", "our_score", "opponent_score", "outcome"]),
    "0014 insufficient"
  );
});

test("une ligne avec adverse → tableau ; sans adverse → vide honnête", () => {
  const unlinked = [
    {
      club_id: "a",
      opponent_club_id: null,
      competition_id: null,
      outcome: "WIN",
      our_score: 2,
      opponent_score: 1,
    },
  ];
  const linked = [
    {
      club_id: "a",
      opponent_club_id: "b",
      competition_id: null,
      outcome: "WIN",
      our_score: 2,
      opponent_score: 1,
    },
  ];
  assert.false(isCpcClubRankingResult(unlinked[0]), "no opponent");
  assert.true(isCpcClubRankingResult(linked[0]), "with opponent");
  assert.false(hasCpcClubRankingResults([]), "empty");
  assert.false(hasCpcClubRankingResults(unlinked), "unlinked");
  assert.true(hasCpcClubRankingResults(linked), "linked");
  assert.false(canShowCpcClubRanking([]), "no table empty");
  assert.false(canShowCpcClubRanking(unlinked), "no table unlinked");
  assert.true(canShowCpcClubRanking(linked), "table when ≥1");
  assert.false(
    canShowCpcClubRanking(linked, ["id", "club_id", "outcome"]),
    "schema without opponent_club_id"
  );
});

test("scorer famille compétitions : W=3 D=1 L=0, les deux clubs, pas de 0-0-0 inventé", () => {
  assert.equal(COMPETITION_POINTS.WIN, 3, "win");
  assert.equal(COMPETITION_POINTS.DRAW, 1, "draw");
  assert.equal(COMPETITION_POINTS.LOSS, 0, "loss");

  const rows = [
    {
      club_id: "alpha",
      opponent_club_id: "beta",
      competition_id: "c1",
      outcome: "WIN",
      our_score: 2,
      opponent_score: 1,
    },
    {
      club_id: "alpha",
      opponent_club_id: "gamma",
      competition_id: null,
      outcome: "DRAW",
      our_score: 1,
      opponent_score: 1,
    },
    {
      club_id: "beta",
      opponent_club_id: "gamma",
      competition_id: "c1",
      outcome: "LOSS",
      our_score: 0,
      opponent_score: 3,
    },
    {
      club_id: "alpha",
      opponent_club_id: null,
      competition_id: null,
      outcome: "WIN",
      our_score: 9,
      opponent_score: 0,
    },
    {
      club_id: "omega",
      opponent_club_id: "omega",
      competition_id: null,
      outcome: "WIN",
      our_score: 1,
      opponent_score: 0,
    },
  ];

  const table = computeCpcClubStandings(rows);
  assert.equal(table.length, 3, "only clubs that played with an opponent");
  assert.equal(table[0].clubId, "gamma", "gamma first");
  assert.equal(table[0].points, 4, "gamma pts");
  assert.equal(table[0].wins, 1, "gamma W");
  assert.equal(table[0].draws, 1, "gamma D");
  assert.equal(table[0].losses, 0, "gamma L");
  assert.equal(table[0].played, 2, "gamma J");
  assert.equal(table[0].goalsFor, 4, "gamma GF");
  assert.equal(table[0].goalsAgainst, 1, "gamma GA");
  assert.equal(table[1].clubId, "alpha", "alpha second");
  assert.equal(table[1].points, 4, "alpha pts");
  assert.equal(table[2].clubId, "beta", "beta last");
  assert.equal(table[2].points, 0, "beta pts");
  assert.equal(table[2].losses, 2, "beta L");
  assert.equal(computeCpcClubStandings([]).length, 0, "empty");
  assert.equal(
    computeCpcClubStandings([
      { club_id: "x", opponent_club_id: null, competition_id: null, outcome: "WIN", our_score: 1, opponent_score: 0 },
    ]).length,
    0,
    "unlinked ignored"
  );

  const competitionOnly = computeCompetitionStandings(rows, "c1");
  assert.equal(competitionOnly.length, 3, "competition still 3");
  assert.equal(competitionOnly[0].clubId, "gamma", "same family order");
  const alphaCpc = table.find((r) => r.clubId === "alpha");
  const alphaComp = competitionOnly.find((r) => r.clubId === "alpha");
  assert.true((alphaCpc?.played ?? 0) > (alphaComp?.played ?? 0), "CPC counts friendly with opponent");
});

test("tie-break : points, GD, GF, clubId", () => {
  const table = computeCpcClubStandings([
    {
      club_id: "zeta",
      opponent_club_id: "eta",
      competition_id: null,
      outcome: "DRAW",
      our_score: 1,
      opponent_score: 1,
    },
  ]);
  assert.equal(table[0].clubId, "eta", "clubId asc");
  assert.equal(table[1].clubId, "zeta", "second");
  assert.equal(table[0].points, 1, "both 1");
  assert.equal(table[1].points, 1, "both 1 b");
});

test("copy FR honnête, pas de 0-0-0 / % / ovr", () => {
  assert.equal(RANKING_COPY.clubEmpty, "Pas encore de match CPC enregistré avec un adversaire.", "empty");
  assert.true(RANKING_COPY.clubEmptyHint.includes("0-0-0"), "mentions no fake table");
  assert.true(RANKING_COPY.clubEmptyHint.toLowerCase().includes("inventé"), "no invent");
  assert.false(RANKING_COPY.clubEmpty.includes("0-0-0"), "empty is not a fake table");
  assert.false(RANKING_COPY.clubEmpty.includes("%"), "no percent");
  assert.false(RANKING_COPY.clubEmptyHint.includes("%"), "no percent hint");
  assert.false(RANKING_COPY.clubEmpty.toLowerCase().includes("ovr"), "no ovr");
  assert.true(RANKING_COPY.clubLoadError.toLowerCase().includes("classement"), "error");
});

test("classement joueur skip : join PRESENT existe mais trop mince", () => {
  assert.true(PLAYER_MATCH_HISTORY_JOIN.includes("match_participations"), "join exists");
  assert.true(PLAYER_MATCH_HISTORY_JOIN.includes("match_results"), "results");
  assert.false(CPC_PLAYER_RANKING_AVAILABLE, "flag off");
  assert.false(canShowCpcPlayerRanking(), "no player table");
});

test("ligne classement : tap club seulement si UUID réel + nom chargé — jamais /profile", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(clubRankingRowHref(id, "Invincibles"), `/club/${id}`, "ok");
  assert.equal(clubRankingRowHref("not-a-uuid", "Invincibles"), null, "bad id");
  assert.equal(clubRankingRowHref(id, ""), null, "empty name");
  assert.equal(clubRankingRowHref(id, "Club Pro Clubs"), null, "fallback name");
  assert.equal(clubRankingRowHref(id, "Club"), null, "generic Club");
  assert.equal(clubRankingRowHref(id, "  Club Pro Clubs  "), null, "trimmed fallback");
  assert.equal(clubRankingRowHref(id, null), null, "no name");
  const href = clubRankingRowHref(id, "Invincibles");
  assert.false(Boolean(href && href.includes("/profile/")), "not player profile");
});

test("écran classement : ClubCard MINI si nom réel, jamais placeholder Club Pro Clubs", () => {
  const ranking = readFileSync(`${process.cwd()}/components/rankings/CpcClubRanking.tsx`, "utf8");
  assert.true(ranking.includes("tournamentClubDisplayName"), "honest name");
  assert.true(ranking.includes("buildClubCardData"), "ClubCard builder");
  assert.true(ranking.includes('variant="mini"'), "MINI density");
  assert.true(ranking.includes("clubRankingRowHref"), "href doctrine");
  assert.false(ranking.includes('"Club Pro Clubs"'), "no placeholder literal");
  assert.false(ranking.includes("?? \"Club Pro Clubs\""), "no display fallback");
  assert.false(ranking.includes("0-0-0"), "no fake 0-0-0");
});

console.log(`\n${passed} tests OK`);

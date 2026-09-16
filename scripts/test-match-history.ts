/**
 * Tests de lib/matchHistory.ts — join réel finalize_match, vide honnête.
 * Sans réseau. Lancer : npx tsx scripts/test-match-history.ts
 */
import {
  CLUB_MATCH_HISTORY_JOIN,
  MATCH_HISTORY_COPY,
  MATCH_HISTORY_LIMIT,
  PLAYER_MATCH_HISTORY_JOIN,
  PLAYER_MATCH_HISTORY_LOOKBACK,
  buildClubMatchHistory,
  buildPlayerMatchHistory,
  countPlayerCpcMatches,
  formatMatchHistoryDate,
  formatMatchScore,
  isEmptyMatchHistoryReadError,
  isPersistedMatchOutcome,
  type MatchHistoryResultInput,
} from "../lib/matchHistory";
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
  equalJson(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée (${label}).\n  reçu: ${a}\n  attendu: ${b}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

function result(overrides: Partial<MatchHistoryResultInput> & Pick<MatchHistoryResultInput, "id" | "match_checkin_id">): MatchHistoryResultInput {
  return {
    club_id: "club-a",
    our_score: 3,
    opponent_score: 1,
    outcome: "WIN",
    created_at: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

console.log("lib/matchHistory.ts — join PRESENT + match_results");

test("join documenté : participations PRESENT → match_results, pas mvp/slot_assignments/season_stats", () => {
  assert.true(PLAYER_MATCH_HISTORY_JOIN.includes("match_participations"), "participations");
  assert.true(PLAYER_MATCH_HISTORY_JOIN.includes("PRESENT"), "PRESENT");
  assert.true(PLAYER_MATCH_HISTORY_JOIN.includes("match_results"), "results");
  assert.true(PLAYER_MATCH_HISTORY_JOIN.includes("finalize_match"), "finalize");
  assert.false(PLAYER_MATCH_HISTORY_JOIN.includes("season_stats"), "pas season_stats");
  assert.false(PLAYER_MATCH_HISTORY_JOIN.includes("mvp_user_id"), "pas filtre mvp");
  assert.equal(CLUB_MATCH_HISTORY_JOIN, "match_results.club_id", "join club");
});

test("copy vide exacte — jamais un faux 0-0", () => {
  assert.equal(MATCH_HISTORY_COPY.empty, "Pas encore de matchs", "empty");
  assert.false(MATCH_HISTORY_COPY.empty.toLowerCase().includes("0-0"), "pas 0-0");
  assert.false(MATCH_HISTORY_COPY.empty.includes("0 — 0"), "pas 0 — 0");
});

test("aucune participation PRESENT → liste vide (pas de ligne inventée)", () => {
  const items = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "ABSENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1" })],
    clubNames: { "club-a": "Les Invincibles" },
  });
  assert.equal(items.length, 0, "empty");
});

test("PRESENT sans match_results (check-in non finalisé) → vide", () => {
  const items = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [],
  });
  assert.equal(items.length, 0, "empty");
});

test("PRESENT + finalize_match → date, club, score, issue", () => {
  const items = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1", created_at: "2026-08-20T12:00:00.000Z" })],
    clubNames: { "club-a": "Les Invincibles" },
  });
  assert.equal(items.length, 1, "one");
  assert.equal(items[0].clubName, "Les Invincibles", "club");
  assert.equal(items[0].scoreLine, "3 — 1", "score");
  assert.equal(items[0].outcome, "WIN", "outcome");
  assert.equal(items[0].dateLabel, "20 août 2026", "date");
});

test("ABSENT avec un résultat persisté n'apparaît pas sur la carte joueur", () => {
  const items = buildPlayerMatchHistory({
    participations: [
      { match_checkin_id: "played", status: "PRESENT" },
      { match_checkin_id: "missed", status: "ABSENT" },
    ],
    results: [
      result({ id: "r-played", match_checkin_id: "played", our_score: 2, opponent_score: 0 }),
      result({ id: "r-missed", match_checkin_id: "missed", our_score: 1, opponent_score: 4, outcome: "LOSS" }),
    ],
  });
  assert.equal(items.length, 1, "only present");
  assert.equal(items[0].id, "r-played", "id");
});

test("mvp_user_id seul (sans PRESENT) ne crée pas de ligne joueur", () => {
  const items = buildPlayerMatchHistory({
    participations: [],
    results: [result({ id: "r-mvp", match_checkin_id: "c1" })],
  });
  assert.equal(items.length, 0, "no mvp shortcut");
});

test("scores absents → scoreLine null, jamais un faux 0-0 ; issue conservée", () => {
  const items = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1", our_score: null, opponent_score: null, outcome: "WIN" })],
  });
  assert.equal(items.length, 1, "row kept");
  assert.equal(items[0].scoreLine, null, "no fake score");
  assert.equal(items[0].outcome, "WIN", "outcome kept");
});

test("vrai 0-0 persisté (DRAW) s'affiche — ce n'est pas un score inventé", () => {
  const items = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1", our_score: 0, opponent_score: 0, outcome: "DRAW" })],
  });
  assert.equal(items[0].scoreLine, "0 — 0", "real draw");
  assert.equal(items[0].outcome, "DRAW", "draw");
});

test("outcome invalide (pas un finalize_match) → ligne exclue", () => {
  const items = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1", outcome: "PENDING" })],
  });
  assert.equal(items.length, 0, "excluded");
});

test("lookback PRESENT plus large que la liste affichée (check-ins non finalisés)", () => {
  assert.true(PLAYER_MATCH_HISTORY_LOOKBACK > MATCH_HISTORY_LIMIT, "lookback > limit");
  assert.true(PLAYER_MATCH_HISTORY_LOOKBACK <= 80, "lookback borné");
});

test("tri du plus récent + limite courte", () => {
  const participations = Array.from({ length: 8 }, (_, i) => ({
    match_checkin_id: `c${i}`,
    status: "PRESENT" as const,
  }));
  const results = Array.from({ length: 8 }, (_, i) =>
    result({
      id: `r${i}`,
      match_checkin_id: `c${i}`,
      created_at: `2026-08-${String(10 + i).padStart(2, "0")}T12:00:00.000Z`,
    })
  );
  const items = buildPlayerMatchHistory({ participations, results });
  assert.equal(items.length, MATCH_HISTORY_LIMIT, "limit");
  assert.equal(items[0].id, "r7", "newest");
  assert.equal(items[4].id, "r3", "fifth");
});

test("profil club : match_results.club_id réel, ignore les autres clubs", () => {
  const items = buildClubMatchHistory({
    clubId: "club-a",
    clubName: "Les Invincibles",
    results: [
      result({ id: "ours", match_checkin_id: "c1", club_id: "club-a", our_score: 4, opponent_score: 2 }),
      result({ id: "theirs", match_checkin_id: "c2", club_id: "club-b", our_score: 9, opponent_score: 9, outcome: "DRAW" }),
    ],
  });
  assert.equal(items.length, 1, "only our club");
  assert.equal(items[0].id, "ours", "id");
  assert.equal(items[0].clubName, "Les Invincibles", "name");
  assert.equal(items[0].scoreLine, "4 — 2", "score");
});

test("profil club vide si aucun match_results pour ce club", () => {
  const items = buildClubMatchHistory({
    clubId: "club-a",
    results: [result({ id: "other", match_checkin_id: "c1", club_id: "club-b" })],
  });
  assert.equal(items.length, 0, "empty");
});

test("formatMatchScore refuse les non-nombres (pas de 0-0 de repli)", () => {
  assert.equal(formatMatchScore(undefined, 0), null, "undef our");
  assert.equal(formatMatchScore(0, undefined), null, "undef opp");
  assert.equal(formatMatchScore("1", "0"), null, "strings");
  assert.equal(formatMatchScore(1, 0), "1 — 0", "ok");
});

test("formatMatchHistoryDate UTC ; ISO invalide → null", () => {
  assert.equal(formatMatchHistoryDate("2026-01-05T00:00:00.000Z"), "5 janv. 2026", "jan");
  assert.equal(formatMatchHistoryDate("not-a-date"), null, "invalid");
});

test("isPersistedMatchOutcome : WIN/DRAW/LOSS seulement", () => {
  assert.true(isPersistedMatchOutcome("WIN"), "win");
  assert.true(isPersistedMatchOutcome("DRAW"), "draw");
  assert.true(isPersistedMatchOutcome("LOSS"), "loss");
  assert.false(isPersistedMatchOutcome("WINNER"), "winner");
  assert.false(isPersistedMatchOutcome(null), "null");
});

test("countPlayerCpcMatches : vide = 0 ; PRESENT + résultat = compte, pas de buts inventés", () => {
  assert.equal(
    countPlayerCpcMatches({ participations: [], results: [] }),
    0,
    "empty"
  );
  assert.equal(
    countPlayerCpcMatches({
      participations: [{ match_checkin_id: "c1", status: "ABSENT" }],
      results: [result({ id: "r1", match_checkin_id: "c1" })],
    }),
    0,
    "absent doesn't count"
  );
  assert.equal(
    countPlayerCpcMatches({
      participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
      results: [result({ id: "r1", match_checkin_id: "c1" })],
    }),
    1,
    "one"
  );
});

test("adversaire club : nom MINI seulement si opponent_club_id + nom hydraté", () => {
  const none = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1" })],
  });
  assert.equal(none[0].opponentClubId, null, "pas d'adverse");
  assert.equal(none[0].opponentClubName, null, "pas de nom inventé");

  const named = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1", opponent_club_id: "club-b" })],
    clubNames: { "club-a": "Les Invincibles", "club-b": "Rival FC" },
  });
  assert.equal(named[0].opponentClubId, "club-b", "id");
  assert.equal(named[0].opponentClubName, "Rival FC", "name");

  const idOnly = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1", opponent_club_id: "club-b" })],
    clubNames: { "club-a": "Les Invincibles" },
  });
  assert.equal(idOnly[0].opponentClubId, "club-b", "id known");
  assert.equal(idOnly[0].opponentClubName, null, "nom non hydraté → omis");
});

test("noms manquants ou placeholder → omis, jamais Club Pro Clubs", () => {
  const missing = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1" })],
  });
  assert.equal(missing[0].clubName, null, "own name omitted");
  assert.equal(missing[0].scoreLine, "3 — 1", "score réel conservé");

  const placeholders = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [result({ id: "r1", match_checkin_id: "c1", opponent_club_id: "club-b" })],
    clubNames: { "club-a": "Club Pro Clubs", "club-b": "Club" },
  });
  assert.equal(placeholders[0].clubName, null, "own placeholder omitted");
  assert.equal(placeholders[0].opponentClubName, null, "opponent placeholder omitted");

  const clubPlaceholder = buildClubMatchHistory({
    clubId: "club-a",
    clubName: "Club Pro Clubs",
    results: [result({ id: "ours", match_checkin_id: "c1", club_id: "club-a" })],
  });
  assert.equal(clubPlaceholder[0].clubName, null, "club profile placeholder omitted");
  assert.equal(clubPlaceholder[0].scoreLine, "3 — 1", "club score réel");

  const src = readFileSync(`${process.cwd()}/lib/matchHistory.ts`, "utf8");
  assert.true(src.includes("tournamentClubDisplayName"), "shared helper");
  assert.false(src.includes('"Club Pro Clubs"'), "no fallback literal");
});

test("0 rows / PGRST116 = vide, jamais ErrorState ; pas d'order referencedTable", () => {
  assert.true(isEmptyMatchHistoryReadError({ code: "PGRST116" }), "pgrst");
  assert.true(isEmptyMatchHistoryReadError({ message: "could not find a relationship" }), "relationship");
  assert.false(isEmptyMatchHistoryReadError({ code: "42501", message: "permission denied" }), "rls");
  const hook = readFileSync(`${process.cwd()}/lib/hooks/useMatchHistory.ts`, "utf8");
  assert.false(hook.includes("referencedTable"), "no referencedTable order");
  assert.true(hook.includes("isEmptyMatchHistoryReadError"), "gone-read");
});

console.log(`\n${passed} test(s) passés.`);

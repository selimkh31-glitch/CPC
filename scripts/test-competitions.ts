/**
 * Tests de lib/competitions.ts — validation, RLS miroir, unique 409, SQL fondation.
 * Sans réseau. Lancer : npx tsx scripts/test-competitions.ts
 */
import {
  canFillStandingsFromMatchResults,
  canInsertCompetition,
  canRegisterCompetitionClub,
  canShowCompetitionStandings,
  competitionIsReadable,
  competitionsFoundationSqlIssues,
  computeCompetitionStandings,
  COMPETITION_COPY,
  COMPETITION_NAME_MAX,
  COMPETITION_POINTS,
  COMPETITION_STATUS_LABELS,
  hasLinkedCompetitionResults,
  inverseMatchOutcome,
  isCompetitionCreateStatus,
  isCompetitionStatus,
  matchResultLinkSqlIssues,
  MATCH_RESULT_COLUMNS,
  normalizeCompetitionName,
  POSTGRES_UNIQUE_VIOLATION,
  registerBlockHttpStatus,
  registerBlockMessage,
  uniqueViolationHttpStatus,
} from "../lib/competitions";

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

console.log("lib/competitions.ts");

test("statuts DRAFT|OPEN|CLOSED — CLOSED n'est pas créable", () => {
  assert.true(isCompetitionStatus("DRAFT"), "draft");
  assert.true(isCompetitionStatus("OPEN"), "open");
  assert.true(isCompetitionStatus("CLOSED"), "closed");
  assert.false(isCompetitionStatus("ACTIVE"), "pas de théâtre ACTIVE");
  assert.true(isCompetitionCreateStatus("DRAFT"), "create draft");
  assert.true(isCompetitionCreateStatus("OPEN"), "create open");
  assert.false(isCompetitionCreateStatus("CLOSED"), "closed not create");
});

test("nom trim + bornes 1–80", () => {
  assert.equal(normalizeCompetitionName("  Coupe FC 27  "), "Coupe FC 27", "trim");
  assert.equal(normalizeCompetitionName(""), null, "empty");
  assert.equal(normalizeCompetitionName("   "), null, "ws");
  assert.equal(normalizeCompetitionName("x".repeat(COMPETITION_NAME_MAX)), "x".repeat(COMPETITION_NAME_MAX), "max");
  assert.equal(normalizeCompetitionName("x".repeat(COMPETITION_NAME_MAX + 1)), null, "too long");
  assert.equal(normalizeCompetitionName(12), null, "not string");
});

test("RLS lecture : OPEN pour tous, DRAFT/CLOSED pour le créateur", () => {
  assert.true(competitionIsReadable("OPEN", "a", "b"), "open other");
  assert.true(competitionIsReadable("DRAFT", "a", "a"), "draft own");
  assert.false(competitionIsReadable("DRAFT", "a", "b"), "draft other");
  assert.false(competitionIsReadable("CLOSED", "a", "b"), "closed other");
  assert.true(competitionIsReadable("CLOSED", "a", "a"), "closed own");
});

test("INSERT : created_by = JWT et DRAFT|OPEN", () => {
  assert.true(canInsertCompetition({ actorId: "u", createdBy: "u", status: "OPEN" }), "open");
  assert.true(canInsertCompetition({ actorId: "u", createdBy: "u", status: "DRAFT" }), "draft");
  assert.false(canInsertCompetition({ actorId: "u", createdBy: "u", status: "CLOSED" }), "closed");
  assert.false(canInsertCompetition({ actorId: "u", createdBy: "other", status: "OPEN" }), "spoof creator");
});

test("register : OPEN + OWNER/MANAGER ; doublon = 409", () => {
  assert.equal(
    canRegisterCompetitionClub({ competitionStatus: "OPEN", actorRole: "OWNER", alreadyRegistered: false }).ok,
    true,
    "owner"
  );
  assert.equal(
    canRegisterCompetitionClub({ competitionStatus: "OPEN", actorRole: "MANAGER", alreadyRegistered: false }).ok,
    true,
    "manager"
  );
  const member = canRegisterCompetitionClub({
    competitionStatus: "OPEN",
    actorRole: "MEMBER",
    alreadyRegistered: false,
  });
  assert.equal(member.ok, false, "member blocked");
  if (!member.ok) {
    assert.equal(member.reason, "not_manager", "reason member");
    assert.equal(registerBlockHttpStatus(member.reason), 403, "403");
  }
  const draft = canRegisterCompetitionClub({
    competitionStatus: "DRAFT",
    actorRole: "OWNER",
    alreadyRegistered: false,
  });
  assert.equal(draft.ok, false, "draft blocked");
  if (!draft.ok) assert.equal(registerBlockHttpStatus(draft.reason), 400, "400 draft");
  const dup = canRegisterCompetitionClub({
    competitionStatus: "OPEN",
    actorRole: "OWNER",
    alreadyRegistered: true,
  });
  assert.equal(dup.ok, false, "dup");
  if (!dup.ok) {
    assert.equal(dup.reason, "already_registered", "reason dup");
    assert.equal(registerBlockHttpStatus(dup.reason), 409, "409");
    assert.equal(registerBlockMessage(dup.reason), COMPETITION_COPY.registerConflict, "copy 409");
  }
});

test("23505 → 409 ; autre code ignoré", () => {
  assert.equal(uniqueViolationHttpStatus(POSTGRES_UNIQUE_VIOLATION), 409, "unique");
  assert.equal(uniqueViolationHttpStatus("23503"), null, "fk");
  assert.equal(uniqueViolationHttpStatus(undefined), null, "undef");
});

test("lien 0027 autorisé ; standings seulement avec résultats réellement liés", () => {
  assert.true(MATCH_RESULT_COLUMNS.includes("competition_id"), "col competition");
  assert.true(MATCH_RESULT_COLUMNS.includes("opponent_club_id"), "col opponent");
  assert.true(canFillStandingsFromMatchResults(), "default columns 0027");
  assert.false(
    canFillStandingsFromMatchResults(["id", "club_id", "our_score", "opponent_score", "outcome"]),
    "engine 0014 only"
  );
  assert.true(
    canFillStandingsFromMatchResults(["competition_id", "opponent_club_id", "outcome"]),
    "both keys exist"
  );
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
  assert.false(hasLinkedCompetitionResults(unlinked, "c1"), "no keys");
  assert.false(
    hasLinkedCompetitionResults(
      [{ club_id: "a", opponent_club_id: null, competition_id: "c1", outcome: "WIN", our_score: 1, opponent_score: 0 }],
      "c1"
    ),
    "missing opponent"
  );
  assert.false(
    hasLinkedCompetitionResults(
      [{ club_id: "a", opponent_club_id: "b", competition_id: "other", outcome: "WIN", our_score: 1, opponent_score: 0 }],
      "c1"
    ),
    "wrong competition"
  );
  const linked = [
    {
      club_id: "a",
      opponent_club_id: "b",
      competition_id: "c1",
      outcome: "WIN",
      our_score: 2,
      opponent_score: 1,
    },
  ];
  assert.true(hasLinkedCompetitionResults(linked, "c1"), "linked row");
  assert.false(canShowCompetitionStandings([], "c1"), "empty forbidden");
  assert.false(canShowCompetitionStandings(unlinked, "c1"), "unlinked forbidden");
  assert.true(canShowCompetitionStandings(linked, "c1"), "linked allowed");
});

test("scorer W/D/L déterministe — win 3, draw 1, loss 0 ; ignore non liés ; pas de rows inventés", () => {
  assert.equal(COMPETITION_POINTS.WIN, 3, "win pts");
  assert.equal(COMPETITION_POINTS.DRAW, 1, "draw pts");
  assert.equal(COMPETITION_POINTS.LOSS, 0, "loss pts");
  assert.equal(inverseMatchOutcome("WIN"), "LOSS", "inv win");
  assert.equal(inverseMatchOutcome("LOSS"), "WIN", "inv loss");
  assert.equal(inverseMatchOutcome("DRAW"), "DRAW", "inv draw");

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
      competition_id: "c1",
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
      opponent_club_id: "beta",
      competition_id: null,
      outcome: "WIN",
      our_score: 9,
      opponent_score: 0,
    },
    {
      club_id: "alpha",
      opponent_club_id: null,
      competition_id: "c1",
      outcome: "WIN",
      our_score: 8,
      opponent_score: 0,
    },
    {
      club_id: "alpha",
      opponent_club_id: "beta",
      competition_id: "c-other",
      outcome: "WIN",
      our_score: 7,
      opponent_score: 0,
    },
  ];
  const table = computeCompetitionStandings(rows, "c1");
  assert.equal(table.length, 3, "only clubs that played a linked match");
  assert.equal(table[0].clubId, "gamma", "gamma first (4 pts, +3 GD)");
  assert.equal(table[0].points, 4, "gamma pts");
  assert.equal(table[0].wins, 1, "gamma W");
  assert.equal(table[0].draws, 1, "gamma D");
  assert.equal(table[0].losses, 0, "gamma L");
  assert.equal(table[0].played, 2, "gamma J");
  assert.equal(table[0].goalsFor, 4, "gamma GF");
  assert.equal(table[0].goalsAgainst, 1, "gamma GA");
  assert.equal(table[1].clubId, "alpha", "alpha second (4 pts, +1 GD)");
  assert.equal(table[1].points, 4, "alpha pts");
  assert.equal(table[1].wins, 1, "alpha W");
  assert.equal(table[1].draws, 1, "alpha D");
  assert.equal(table[1].losses, 0, "alpha L");
  assert.equal(table[2].clubId, "beta", "beta last");
  assert.equal(table[2].points, 0, "beta pts");
  assert.equal(table[2].wins, 0, "beta W");
  assert.equal(table[2].draws, 0, "beta D");
  assert.equal(table[2].losses, 2, "beta L");
  assert.equal(computeCompetitionStandings([], "c1").length, 0, "empty");
  assert.equal(
    computeCompetitionStandings(
      [{ club_id: "x", opponent_club_id: null, competition_id: "c1", outcome: "WIN", our_score: 1, opponent_score: 0 }],
      "c1"
    ).length,
    0,
    "unlinked opponent ignored"
  );
});

test("tie-break déterministe : points, GD, GF, puis clubId", () => {
  const rows = [
    {
      club_id: "zeta",
      opponent_club_id: "eta",
      competition_id: "c1",
      outcome: "DRAW",
      our_score: 1,
      opponent_score: 1,
    },
  ];
  const table = computeCompetitionStandings(rows, "c1");
  assert.equal(table[0].clubId, "eta", "clubId asc when equal");
  assert.equal(table[1].clubId, "zeta", "second");
  assert.equal(table[0].points, 1, "both 1");
  assert.equal(table[1].points, 1, "both 1 b");
});

test("copy FR virtuel Pro Clubs, jamais IRL / pas de % inventé", () => {
  assert.true(COMPETITION_COPY.subtitle.includes("EA SPORTS FC 27 Pro Clubs"), "fc27");
  assert.true(COMPETITION_COPY.subtitle.includes("Pas de football IRL"), "irl");
  assert.equal(COMPETITION_STATUS_LABELS.OPEN, "Ouverte", "open label");
  assert.false(COMPETITION_COPY.subtitle.includes("%"), "no percent");
  assert.false(COMPETITION_COPY.empty.includes("tournoi"), "no tournament theater");
  assert.true(COMPETITION_COPY.standingsEmpty.includes("match lié"), "standings empty");
  assert.true(COMPETITION_COPY.standingsEmptyHint.includes("Aucun point inventé"), "no invent points");
  assert.false(COMPETITION_COPY.standingsEmpty.includes("%"), "no percent standings");
});

test("liste/inscription : clubs inscrits = noms, pas de CTA contact à inventer", () => {
  assert.true(COMPETITION_COPY.registerCta.toLowerCase().includes("club"), "register club");
  assert.false(COMPETITION_COPY.registerCta.toLowerCase().includes("message"), "no dm cta");
  assert.false(COMPETITION_COPY.title.toLowerCase().includes("message"), "no message title");
});

test("SQL fondation : tables + unique + RLS ; refuse standings / alter match_results", () => {
  const valid = `
    create table if not exists public.competitions (id uuid);
    create table if not exists public.competition_clubs (id uuid);
    constraint competition_clubs_pair_unique unique (competition_id, club_id)
    check (status in ('DRAFT', 'OPEN', 'CLOSED'))
    competitions_select_open_or_own
    competitions_insert_creator
    competition_clubs_insert_manager
    grant all privileges on public.competitions to service_role
  `;
  assert.equal(competitionsFoundationSqlIssues(valid).join(" | "), "", "contrat 0026");
  const withStandings = `${valid}\ncreate table if not exists public.standings (id uuid);`;
  assert.true(competitionsFoundationSqlIssues(withStandings).some((i) => i.startsWith("interdit:")), "no standings");
  const altersResults = `${valid}\nalter table public.match_results add column competition_id uuid;`;
  assert.true(competitionsFoundationSqlIssues(altersResults).some((i) => i.includes("match_results")), "no 2e moteur");
  assert.true(competitionsFoundationSqlIssues("create table public.foo ()").length > 0, "sql incomplet");
});

test("SQL 0027 : ALTER match_results + finalize étendu ; pas de table standings / INSERT client", () => {
  const valid = `
    alter table public.match_results add column if not exists opponent_club_id uuid;
    alter table public.match_results add column if not exists competition_id uuid;
    check (opponent_club_id is distinct from club_id)
    create or replace function public.finalize_match(
      p_match_checkin_id uuid, p_actor_id uuid, p_our_score int, p_opponent_score int,
      p_mvp_user_id uuid, p_opponent_club_id uuid, p_competition_id uuid
    )
    raise exception 'clubs_not_in_competition';
    grant execute on function public.finalize_match(uuid, uuid, int, int, uuid, uuid, uuid) to service_role;
  `;
  assert.equal(matchResultLinkSqlIssues(valid).join(" | "), "", "contrat 0027");
  const withStandings = `${valid}\ncreate table if not exists public.standings (id uuid);`;
  assert.true(matchResultLinkSqlIssues(withStandings).some((i) => i.startsWith("interdit:")), "no standings table");
  const clientInsert = `${valid}\ncreate policy x on public.match_results for insert to authenticated with check (true);`;
  assert.true(matchResultLinkSqlIssues(clientInsert).some((i) => i.includes("insert")), "no client insert");
});

console.log(`\n${passed} tests OK`);

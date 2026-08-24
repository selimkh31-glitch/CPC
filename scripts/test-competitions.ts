/**
 * Tests de lib/competitions.ts — validation, RLS miroir, unique 409, SQL fondation.
 * Sans réseau. Lancer : npx tsx scripts/test-competitions.ts
 */
import {
  canFillStandingsFromMatchResults,
  canInsertCompetition,
  canRegisterCompetitionClub,
  competitionIsReadable,
  competitionsFoundationSqlIssues,
  COMPETITION_COPY,
  COMPETITION_NAME_MAX,
  COMPETITION_STATUS_LABELS,
  isCompetitionCreateStatus,
  isCompetitionStatus,
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

test("pas de standings inventés depuis match_results (colonnes actuelles)", () => {
  assert.false(canFillStandingsFromMatchResults(), "default columns");
  assert.false(
    canFillStandingsFromMatchResults(["id", "club_id", "our_score", "opponent_score", "outcome"]),
    "engine 0014"
  );
  assert.true(
    canFillStandingsFromMatchResults(["competition_id", "opponent_club_id", "outcome"]),
    "only if both keys exist"
  );
});

test("copy FR virtuel Pro Clubs, jamais IRL / pas de % inventé", () => {
  assert.true(COMPETITION_COPY.subtitle.includes("EA SPORTS FC 27 Pro Clubs"), "fc27");
  assert.true(COMPETITION_COPY.subtitle.includes("Pas de football IRL"), "irl");
  assert.equal(COMPETITION_STATUS_LABELS.OPEN, "Ouverte", "open label");
  assert.false(COMPETITION_COPY.subtitle.includes("%"), "no percent");
  assert.false(COMPETITION_COPY.empty.includes("tournoi"), "no tournament theater");
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

console.log(`\n${passed} tests OK`);

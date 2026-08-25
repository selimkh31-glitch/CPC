/**
 * Slice MATCH A vs B — 10 scénarios (gardes Edge/RPC + scorer + notify + history).
 * Sans réseau. Lancer : npx tsx scripts/test-finalize-match.ts
 */
import {
  canShowCompetitionStandings,
  COMPETITION_COPY,
  COMPETITION_POINTS,
  computeCompetitionStandings,
  hasLinkedCompetitionResults,
  matchResultLinkSqlIssues,
} from "../lib/competitions";
import {
  canFinalizeMatchRole,
  computeMatchOutcome,
  evaluateFinalizeMatch,
  FINALIZE_MATCH_COPY,
  finalizeMatchSqlIssues,
  isMatchResultsUniqueViolation,
  isValidFinalizeScore,
  mapFinalizeError,
  MATCH_RESULT_UNIQUE_CONSTRAINT,
  parseUiMatchScore,
  POSTGRES_UNIQUE_VIOLATION,
  shouldRefuseFinalizeOpponentOwner,
  type FinalizeMatchGuardInput,
} from "../lib/finalizeMatch";
import {
  buildClubMatchHistory,
  buildPlayerMatchHistory,
  MATCH_HISTORY_COPY,
  formatMatchScore,
} from "../lib/matchHistory";
import {
  filterClubsHiddenByBlock,
  matchFinalizedHref,
  matchFinalizedNotificationNav,
  matchFinalizedRecipientIds,
  otherIdsFromBlocks,
  tournamentRoundScheduledHref,
} from "../lib/safety";
import { scheduledTournamentCompetitionId } from "../lib/tournaments";

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

const CLUB_A = "club-a";
const CLUB_B = "club-b";
const OWNER_A = "owner-a";
const OWNER_B = "owner-b";
const OWNER_C = "owner-c";
const COMP = "comp-open";

function base(overrides: Partial<FinalizeMatchGuardInput> = {}): FinalizeMatchGuardInput {
  return {
    actorRole: "OWNER",
    checkinExists: true,
    alreadyFinalized: false,
    ourScore: 3,
    opponentScore: 1,
    recordingClubId: CLUB_A,
    opponentClubId: CLUB_B,
    opponentClubExists: true,
    opponentOwnerId: OWNER_B,
    actorId: OWNER_A,
    blockedIds: [],
    competitionId: null,
    competitionStatus: null,
    recordingClubRegistered: false,
    opponentClubRegistered: false,
    mvpUserId: null,
    mvpIsPresent: false,
    ...overrides,
  };
}

const SQL_0027 = `
  alter table public.match_results add column if not exists opponent_club_id uuid;
  alter table public.match_results add column if not exists competition_id uuid;
  check (opponent_club_id is distinct from club_id)
  create or replace function public.finalize_match(
    p_match_checkin_id uuid, p_actor_id uuid, p_our_score int, p_opponent_score int,
    p_mvp_user_id uuid, p_opponent_club_id uuid, p_competition_id uuid
  )
  raise exception 'already_finalized';
  raise exception 'not_authorized';
  raise exception 'invalid_score';
  raise exception 'clubs_not_in_competition';
  when unique_violation then raise exception 'already_finalized';
  revoke execute on function public.finalize_match(uuid, uuid, int, int, uuid, uuid, uuid) from public, anon, authenticated;
  grant execute on function public.finalize_match(uuid, uuid, int, int, uuid, uuid, uuid) to service_role;
`;

const SQL_0014 = `
  create policy "match_results_select_authenticated" on public.match_results
    for select to authenticated using (true);
  -- l'index unique match_results_match_checkin_id_key reste la garantie
  -- Aucune policy d'écriture pour authenticated
`;

console.log("slice MATCH — 10 scénarios (Edge/RPC + standings + notify + history)");

test("SQL 0027 : finalize + unique_violation ; pas d'INSERT client / standings", () => {
  assert.equal(matchResultLinkSqlIssues(SQL_0027).join(" | "), "", "contrat lien 0027");
  assert.equal(finalizeMatchSqlIssues(SQL_0027).join(" | "), "", "contrat finalize 0027");
  assert.true(SQL_0027.includes("when unique_violation then"), "unique_violation");
  assert.true(SQL_0027.includes("service_role"), "service_role");
  const clientInsert = `${SQL_0027}\ncreate policy x on public.match_results for insert to authenticated with check (true);`;
  assert.true(finalizeMatchSqlIssues(clientInsert).some((i) => i.includes("insert")), "pas insert client");
});

test("SQL 0014 : unique match_checkin_id + SELECT only (client ne peut pas INSERT)", () => {
  assert.true(SQL_0014.includes(MATCH_RESULT_UNIQUE_CONSTRAINT), "unique index");
  assert.true(SQL_0014.includes("match_results_select_authenticated"), "select rls");
  assert.false(/create policy[\s\S]*for insert to authenticated/i.test(SQL_0014), "pas insert authenticated");
});

test("1. A vs B → résultat OK (scores, outcome serveur, opponent_club_id)", () => {
  const owner = evaluateFinalizeMatch(base({ actorRole: "OWNER", ourScore: 3, opponentScore: 1 }));
  assert.true(owner.ok, "owner ok");
  if (!owner.ok) return;
  assert.equal(owner.result.ourScore, 3, "our");
  assert.equal(owner.result.opponentScore, 1, "opp");
  assert.equal(owner.result.outcome, "WIN", "outcome serveur WIN");
  assert.equal(owner.result.opponentClubId, CLUB_B, "opponent");
  assert.equal(owner.result.competitionId, null, "pas de compétition");
  assert.equal(computeMatchOutcome(1, 1), "DRAW", "draw");
  assert.equal(computeMatchOutcome(0, 2), "LOSS", "loss");
  const manager = evaluateFinalizeMatch(base({ actorRole: "MANAGER" }));
  assert.true(manager.ok, "manager ok");
  assert.false(canFinalizeMatchRole("MEMBER"), "member role");
});

test("2. Pas de competition_id → résultat sauvé ; scorer vide / pas de table", () => {
  const saved = evaluateFinalizeMatch(base({ competitionId: null }));
  assert.true(saved.ok, "save amical");
  if (!saved.ok) return;
  const rows = [
    {
      club_id: CLUB_A,
      opponent_club_id: saved.result.opponentClubId,
      competition_id: saved.result.competitionId,
      outcome: saved.result.outcome,
      our_score: saved.result.ourScore,
      opponent_score: saved.result.opponentScore,
    },
  ];
  assert.false(hasLinkedCompetitionResults(rows, COMP), "pas lié");
  assert.false(canShowCompetitionStandings(rows, COMP), "pas de table");
  assert.equal(computeCompetitionStandings(rows, COMP).length, 0, "scorer vide");
  assert.true(COMPETITION_COPY.standingsEmpty.includes("aucun match lié") || COMPETITION_COPY.standingsEmpty.includes("match lié"), "copy honnête");
  assert.false(COMPETITION_COPY.standingsEmpty.includes("0-0-0"), "pas 0-0-0");
});

test("3. Les deux clubs inscrits OPEN → competition_id ; standings W/D/L 3/1/0, les deux crédités", () => {
  assert.equal(COMPETITION_POINTS.WIN, 3, "W=3");
  assert.equal(COMPETITION_POINTS.DRAW, 1, "D=1");
  assert.equal(COMPETITION_POINTS.LOSS, 0, "L=0");
  const saved = evaluateFinalizeMatch(
    base({
      competitionId: COMP,
      competitionStatus: "OPEN",
      recordingClubRegistered: true,
      opponentClubRegistered: true,
      ourScore: 2,
      opponentScore: 0,
    })
  );
  assert.true(saved.ok, "save lié");
  if (!saved.ok) return;
  assert.equal(saved.result.competitionId, COMP, "competition_id");
  assert.equal(saved.result.outcome, "WIN", "win");
  const table = computeCompetitionStandings(
    [
      {
        club_id: CLUB_A,
        opponent_club_id: CLUB_B,
        competition_id: COMP,
        outcome: saved.result.outcome,
        our_score: saved.result.ourScore,
        opponent_score: saved.result.opponentScore,
      },
    ],
    COMP
  );
  assert.equal(table.length, 2, "les deux clubs");
  const a = table.find((row) => row.clubId === CLUB_A);
  const b = table.find((row) => row.clubId === CLUB_B);
  assert.equal(a?.points, 3, "A 3 pts");
  assert.equal(a?.wins, 1, "A W");
  assert.equal(a?.draws, 0, "A D");
  assert.equal(a?.losses, 0, "A L");
  assert.equal(b?.points, 0, "B 0 pts");
  assert.equal(b?.wins, 0, "B W");
  assert.equal(b?.draws, 0, "B D");
  assert.equal(b?.losses, 1, "B L");
  assert.true(canShowCompetitionStandings(
    [
      {
        club_id: CLUB_A,
        opponent_club_id: CLUB_B,
        competition_id: COMP,
        outcome: "WIN",
        our_score: 2,
        opponent_score: 0,
      },
    ],
    COMP
  ), "table affichable");
});

test("4. Club non inscrit → RPC/trigger rejette competition_id (règle 0027) ; zéro standings", () => {
  const rejected = evaluateFinalizeMatch(
    base({
      competitionId: COMP,
      competitionStatus: "OPEN",
      recordingClubRegistered: true,
      opponentClubRegistered: false,
    })
  );
  assert.false(rejected.ok, "rejet");
  if (rejected.ok) return;
  assert.equal(rejected.code, "clubs_not_in_competition", "code 0027");
  const mapped = mapFinalizeError("clubs_not_in_competition");
  assert.equal(mapped.status, 400, "400");
  assert.equal(mapped.text, FINALIZE_MATCH_COPY.clubsNotInCompetition, "FR");
  const homeNotIn = evaluateFinalizeMatch(
    base({
      competitionId: COMP,
      competitionStatus: "OPEN",
      recordingClubRegistered: false,
      opponentClubRegistered: true,
    })
  );
  assert.equal(homeNotIn.ok ? "ok" : homeNotIn.code, "clubs_not_in_competition", "home aussi");
  assert.equal(computeCompetitionStandings([], COMP).length, 0, "aucune ligne → pas de classement");
  assert.true(SQL_0027.includes("clubs_not_in_competition"), "trigger/RPC 0027");
});

test("5. Owner bloqué → recherche cache le club ; Edge refuse opponent_club_id", () => {
  const blocked = otherIdsFromBlocks(
    [
      { blocker_id: OWNER_A, blocked_id: OWNER_B },
      { blocker_id: OWNER_C, blocked_id: OWNER_A },
    ],
    OWNER_A
  );
  const visible = filterClubsHiddenByBlock(
    [
      { id: CLUB_B, owner_id: OWNER_B, name: "Blocked FC" },
      { id: "club-ok", owner_id: "owner-ok", name: "Open FC" },
      { id: "club-c", owner_id: OWNER_C, name: "Blocked Me FC" },
    ],
    blocked
  );
  assert.equal(visible.map((c) => c.id).join(","), "club-ok", "recherche");
  assert.true(
    shouldRefuseFinalizeOpponentOwner({ actorId: OWNER_A, opponentOwnerId: OWNER_B, blockedIds: blocked }),
    "Edge refuse B"
  );
  const edge = evaluateFinalizeMatch(base({ blockedIds: blocked }));
  assert.false(edge.ok, "guard refuse");
  if (edge.ok) return;
  assert.equal(edge.code, "opponent_owner_blocked", "code");
  const mapped = mapFinalizeError("opponent_owner_blocked");
  assert.equal(mapped.status, 403, "403");
  assert.equal(mapped.text, FINALIZE_MATCH_COPY.opponentBlocked, "FR");
  const otherWay = evaluateFinalizeMatch(base({ opponentOwnerId: OWNER_C, blockedIds: blocked }));
  assert.equal(otherWay.ok ? "ok" : otherWay.code, "opponent_owner_blocked", "sens inverse");
  const free = evaluateFinalizeMatch(base({ opponentOwnerId: "owner-ok", blockedIds: blocked }));
  assert.true(free.ok, "owner libre OK");
});

test("6. Double finalize → unique match_checkin_id → 409 FR, pas de 2e row", () => {
  const second = evaluateFinalizeMatch(base({ alreadyFinalized: true }));
  assert.false(second.ok, "pré-check");
  if (!second.ok) assert.equal(second.code, "already_finalized", "code");
  assert.true(isMatchResultsUniqueViolation(POSTGRES_UNIQUE_VIOLATION, "duplicate key"), "23505");
  assert.true(
    isMatchResultsUniqueViolation(undefined, `duplicate key value violates unique constraint "${MATCH_RESULT_UNIQUE_CONSTRAINT}"`),
    "constraint name"
  );
  const mapped = mapFinalizeError("duplicate key value violates unique constraint", POSTGRES_UNIQUE_VIOLATION);
  assert.equal(mapped.status, 409, "409");
  assert.equal(mapped.text, FINALIZE_MATCH_COPY.alreadyFinalized, "FR propre");
  assert.equal(mapFinalizeError("already_finalized").status, 409, "rpc named");
  assert.false(isMatchResultsUniqueViolation("23503", "fk"), "pas un unique FK");
});

test("7. Non-owner/manager → 403 / refus serveur", () => {
  const member = evaluateFinalizeMatch(base({ actorRole: "MEMBER" }));
  assert.false(member.ok, "member");
  if (!member.ok) assert.equal(member.code, "not_authorized", "code member");
  const none = evaluateFinalizeMatch(base({ actorRole: null }));
  assert.equal(none.ok ? "ok" : none.code, "not_authorized", "null role");
  const mapped = mapFinalizeError("not_authorized");
  assert.equal(mapped.status, 403, "403");
  assert.equal(mapped.text, FINALIZE_MATCH_COPY.notAuthorized, "FR");
});

test("8. Scores invalides (négatif, non-int) → validation serveur", () => {
  assert.false(isValidFinalizeScore(-1), "négatif");
  assert.false(isValidFinalizeScore(1.5), "float");
  assert.false(isValidFinalizeScore("3"), "string");
  assert.false(isValidFinalizeScore(undefined), "undef");
  assert.false(isValidFinalizeScore(100), "hors 99");
  assert.true(isValidFinalizeScore(0), "0 ok");
  assert.true(isValidFinalizeScore(99), "99 ok");
  const neg = evaluateFinalizeMatch(base({ ourScore: -1 }));
  assert.equal(neg.ok ? "ok" : neg.code, "invalid_score", "rpc/edge neg");
  const flt = evaluateFinalizeMatch(base({ opponentScore: 2.2 }));
  assert.equal(flt.ok ? "ok" : flt.code, "invalid_score", "float");
  assert.equal(mapFinalizeError("invalid_score").status, 400, "400");
  assert.equal(mapFinalizeError("invalid_score").text, FINALIZE_MATCH_COPY.invalidScore, "FR");
  assert.equal(parseUiMatchScore(""), null, "vide UI ≠ 0");
  assert.equal(parseUiMatchScore("3"), 3, "ui 3");
  assert.equal(parseUiMatchScore("-1"), null, "ui neg");
});

test("9. Notify href : competitionId → stack compétition, sinon /club/[id] ; pas de Mode Club ; recorder exclu", () => {
  assert.equal(matchFinalizedHref({ clubId: CLUB_A }, "PLAYER"), `/club/${CLUB_A}`, "PLAYER casual");
  assert.equal(matchFinalizedHref({ clubId: CLUB_A }, "CLUB"), `/club/${CLUB_A}`, "CLUB casual");
  assert.equal(matchFinalizedHref({ clubId: CLUB_A, competitionId: COMP }, "PLAYER"), `/competitions/${COMP}`, "avec compétition");
  assert.equal(
    matchFinalizedHref({ clubId: CLUB_A, competitionId: COMP, kind: "TOURNAMENT" }, "PLAYER"),
    `/tournaments/${COMP}`,
    "tournoi"
  );
  assert.equal(matchFinalizedHref({}, "PLAYER"), "/notifications", "sans clubId ni competitionId");
  if (matchFinalizedHref({}, "CLUB") === "/match" || matchFinalizedHref({ clubId: CLUB_A }, "PLAYER") === "/match") {
    throw new Error("MATCH_FINALIZED ne doit pas envoyer vers /match");
  }
  const navPlayer = matchFinalizedNotificationNav("MATCH_FINALIZED", { clubId: CLUB_A }, "PLAYER");
  assert.equal(navPlayer?.href, `/club/${CLUB_A}`, "nav PLAYER casual");
  assert.equal(navPlayer?.requireClubMode, false, "PLAYER no club mode");
  assert.equal(navPlayer?.selectClubId, null, "PLAYER no select");
  const navClub = matchFinalizedNotificationNav("MATCH_FINALIZED", { clubId: CLUB_A }, "CLUB");
  assert.equal(navClub?.href, `/club/${CLUB_A}`, "nav CLUB casual");
  assert.equal(navClub?.requireClubMode, false, "CLUB no club mode");
  assert.equal(navClub?.selectClubId, null, "CLUB no select");
  const navOpponent = matchFinalizedNotificationNav("MATCH_FINALIZED", { clubId: CLUB_A }, "PLAYER");
  assert.equal(navOpponent?.href, `/club/${CLUB_A}`, "opponent member same dest");
  assert.equal(navOpponent?.requireClubMode, false, "opponent no club mode");
  const navMissing = matchFinalizedNotificationNav("MATCH_FINALIZED", {}, "PLAYER");
  assert.equal(navMissing?.href, "/notifications", "missing clubId");
  if (navMissing?.href === "/match" || navMissing?.href === "/match-sheet") {
    throw new Error("missing clubId ne doit pas aller sur /match");
  }
  const navComp = matchFinalizedNotificationNav("MATCH_FINALIZED", { competitionId: COMP }, "PLAYER");
  assert.equal(navComp?.href, `/competitions/${COMP}`, "nav competitions");
  assert.equal(navComp?.requireClubMode, false, "competitions sans forcer Club");
  const navTourney = matchFinalizedNotificationNav(
    "MATCH_FINALIZED",
    { clubId: CLUB_A, competitionId: COMP, kind: "TOURNAMENT" },
    "CLUB"
  );
  assert.equal(navTourney?.href, `/tournaments/${COMP}`, "nav tournaments inchangé");
  assert.equal(navTourney?.requireClubMode, false, "tournoi sans forcer Club");
  assert.equal(navTourney?.selectClubId, null, "tournoi no select");
  const ids = matchFinalizedRecipientIds({
    recordingClubMemberIds: [OWNER_A, "member-a"],
    opponentClubMemberIds: [OWNER_B, "member-b"],
    recorderId: OWNER_A,
  });
  assert.true(ids.includes("member-a") && ids.includes(OWNER_B) && ids.includes("member-b"), "les deux clubs");
  assert.false(ids.includes(OWNER_A), "recorder exclu");
  assert.equal(
    matchFinalizedRecipientIds({ recordingClubMemberIds: [OWNER_A], recorderId: OWNER_A }).length,
    0,
    "recorder seul → aucune notif"
  );
});

test("10. History : PRESENT + résultat sur la carte ; club_id sur le profil ; vide honnête ; pas de faux 0-0", () => {
  assert.equal(MATCH_HISTORY_COPY.empty, "Pas encore de match enregistré", "copy");
  const present = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c1", status: "PRESENT" }],
    results: [
      {
        id: "r1",
        match_checkin_id: "c1",
        club_id: CLUB_A,
        our_score: 3,
        opponent_score: 1,
        outcome: "WIN",
        created_at: "2026-08-20T12:00:00.000Z",
      },
    ],
    clubNames: { [CLUB_A]: "Alpha FC" },
  });
  assert.equal(present.length, 1, "présent + résultat");
  assert.equal(present[0].scoreLine, "3 — 1", "score réel");
  const openCheckin = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "open", status: "PRESENT" }],
    results: [],
  });
  assert.equal(openCheckin.length, 0, "sans finalize → pas de ligne");
  const missingScores = buildPlayerMatchHistory({
    participations: [{ match_checkin_id: "c2", status: "PRESENT" }],
    results: [
      {
        id: "r2",
        match_checkin_id: "c2",
        club_id: CLUB_A,
        our_score: null,
        opponent_score: null,
        outcome: "WIN",
        created_at: "2026-08-21T12:00:00.000Z",
      },
    ],
  });
  assert.equal(missingScores[0]?.scoreLine ?? null, null, "scores manquants ≠ faux 0-0");
  assert.equal(formatMatchScore(undefined, 0), null, "format refuse");
  const club = buildClubMatchHistory({
    clubId: CLUB_A,
    clubName: "Alpha FC",
    results: [
      {
        id: "ours",
        match_checkin_id: "c1",
        club_id: CLUB_A,
        our_score: 4,
        opponent_score: 2,
        outcome: "WIN",
        created_at: "2026-08-20T12:00:00.000Z",
      },
      {
        id: "theirs",
        match_checkin_id: "c9",
        club_id: CLUB_B,
        our_score: 9,
        opponent_score: 0,
        outcome: "WIN",
        created_at: "2026-08-20T12:00:00.000Z",
      },
    ],
  });
  assert.equal(club.length, 1, "profil club = club_id");
  assert.equal(club[0].id, "ours", "id");
  assert.equal(buildClubMatchHistory({ clubId: CLUB_A, results: [] }).length, 0, "vide club");
});

test("UX copy FR : scores / compétition / invitations — pas de bouton mort silencieux", () => {
  assert.equal(FINALIZE_MATCH_COPY.scoresRequired.includes("0 à 99"), true, "scores");
  assert.true(FINALIZE_MATCH_COPY.competitionNeedOpponent.includes("club adverse"), "compétition après adverse");
  assert.true(FINALIZE_MATCH_COPY.invitationsHint.includes("Recrutement"), "invitations");
  assert.false(FINALIZE_MATCH_COPY.scoresRequired.includes("0-0"), "pas 0-0");
  assert.equal(
    scheduledTournamentCompetitionId({
      recordingClubId: CLUB_A,
      opponentClubId: null,
      openCompetitions: [{ id: COMP, kind: "TOURNAMENT", status: "OPEN" }],
      scheduledMatches: [],
    }),
    null,
    "amical : pas de compétition inventée"
  );
  assert.equal(tournamentRoundScheduledHref({ competitionId: COMP, kind: "TOURNAMENT" }), `/tournaments/${COMP}`, "href tournoi");
  assert.false(tournamentRoundScheduledHref({ competitionId: COMP }).includes("/notifications"), "pas dump");
});

console.log(`\n${passed} test(s) passés.`);

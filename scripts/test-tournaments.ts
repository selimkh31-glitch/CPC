/**
 * Tests de lib/tournaments.ts — kind TOURNAMENT, paires persistées, scores liés, SQL 0029.
 * Sans réseau. Lancer : npx tsx scripts/test-tournaments.ts
 */
import {
  canInsertTournament,
  canScheduleFirstRound,
  canScheduleRound,
  canShowTournamentBracket,
  FIRST_TOURNAMENT_ROUND,
  isTournamentCreateStatus,
  isTournamentKind,
  isTournamentMatchStatus,
  MIN_CLUBS_TO_SCHEDULE,
  nextRoundClubIds,
  normalizeTournamentName,
  scheduleBlockHttpStatus,
  scheduleBlockMessage,
  scheduleFirstRoundFromClubs,
  TOURNAMENT_COPY,
  TOURNAMENT_KIND,
  TOURNAMENT_NAME_MAX,
  TOURNAMENT_STATUS_LABELS,
  tournamentChampionClubId,
  tournamentDetailHref,
  tournamentMatchIsPlayed,
  tournamentMatchScoreLabel,
  tournamentMatchWinnerId,
  tournamentQualifiedClubIds,
  tournamentV1SqlIssues,
  unpairedRegisteredClubIds,
} from "../lib/tournaments";

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

console.log("lib/tournaments.ts");

test("kind TOURNAMENT ; CLOSED n'est pas créable", () => {
  assert.true(isTournamentKind(TOURNAMENT_KIND), "kind");
  assert.false(isTournamentKind("COMPETITION"), "not standard");
  assert.true(isTournamentCreateStatus("DRAFT"), "draft");
  assert.true(isTournamentCreateStatus("OPEN"), "open");
  assert.false(isTournamentCreateStatus("CLOSED"), "closed");
  assert.true(isTournamentMatchStatus("SCHEDULED"), "scheduled");
  assert.true(isTournamentMatchStatus("PLAYED"), "played");
  assert.false(isTournamentMatchStatus("ACTIVE"), "pas de théâtre ACTIVE");
});

test("nom trim + bornes 1–80", () => {
  assert.equal(normalizeTournamentName("  Coupe FC 27  "), "Coupe FC 27", "trim");
  assert.equal(normalizeTournamentName(""), null, "empty");
  assert.equal(normalizeTournamentName("x".repeat(TOURNAMENT_NAME_MAX + 1)), null, "too long");
});

test("INSERT tournoi : created_by = JWT, DRAFT|OPEN, kind TOURNAMENT", () => {
  assert.true(
    canInsertTournament({ actorId: "u", createdBy: "u", status: "OPEN", kind: "TOURNAMENT" }),
    "open"
  );
  assert.true(canInsertTournament({ actorId: "u", createdBy: "u", status: "DRAFT" }), "draft default kind");
  assert.false(
    canInsertTournament({ actorId: "u", createdBy: "u", status: "OPEN", kind: "COMPETITION" }),
    "wrong kind"
  );
  assert.false(canInsertTournament({ actorId: "u", createdBy: "other", status: "OPEN" }), "spoof");
  assert.false(canInsertTournament({ actorId: "u", createdBy: "u", status: "CLOSED" }), "closed");
});

test("schedule : OPEN + créateur + ≥2 clubs + aucun match existant", () => {
  assert.equal(MIN_CLUBS_TO_SCHEDULE, 2, "min 2");
  const ok = canScheduleFirstRound({
    actorId: "u",
    createdBy: "u",
    status: "OPEN",
    kind: "TOURNAMENT",
    registeredClubCount: 2,
    existingMatchCount: 0,
  });
  assert.equal(ok.ok, true, "ok");
  const few = canScheduleFirstRound({
    actorId: "u",
    createdBy: "u",
    status: "OPEN",
    kind: "TOURNAMENT",
    registeredClubCount: 1,
    existingMatchCount: 0,
  });
  assert.equal(few.ok, false, "one club");
  if (!few.ok) {
    assert.equal(few.reason, "need_two_clubs", "reason few");
    assert.equal(scheduleBlockHttpStatus(few.reason), 400, "400");
    assert.equal(scheduleBlockMessage(few.reason), TOURNAMENT_COPY.needTwoClubs, "copy few");
  }
  const dup = canScheduleFirstRound({
    actorId: "u",
    createdBy: "u",
    status: "OPEN",
    kind: "TOURNAMENT",
    registeredClubCount: 4,
    existingMatchCount: 1,
  });
  assert.equal(dup.ok, false, "already");
  if (!dup.ok) {
    assert.equal(scheduleBlockHttpStatus(dup.reason), 409, "409");
    assert.equal(scheduleBlockMessage(dup.reason), TOURNAMENT_COPY.scheduleLocked, "copy locked");
  }
  const guest = canScheduleFirstRound({
    actorId: "other",
    createdBy: "u",
    status: "OPEN",
    kind: "TOURNAMENT",
    registeredClubCount: 2,
    existingMatchCount: 0,
  });
  assert.equal(guest.ok, false, "not owner");
  if (!guest.ok) assert.equal(scheduleBlockHttpStatus(guest.reason), 403, "403");
  const draft = canScheduleFirstRound({
    actorId: "u",
    createdBy: "u",
    status: "DRAFT",
    kind: "TOURNAMENT",
    registeredClubCount: 2,
    existingMatchCount: 0,
  });
  assert.equal(draft.ok, false, "draft");
  const league = canScheduleFirstRound({
    actorId: "u",
    createdBy: "u",
    status: "OPEN",
    kind: "COMPETITION",
    registeredClubCount: 2,
    existingMatchCount: 0,
  });
  assert.equal(league.ok, false, "not tournament");
  if (!league.ok) assert.equal(league.reason, "not_a_tournament", "reason kind");
});

test("premier tour déterministe : tri ids, pas de bye inventé, <2 = vide", () => {
  const empty = scheduleFirstRoundFromClubs([]);
  assert.equal(empty.pairings.length, 0, "0 clubs");
  assert.equal(empty.unpairedClubIds.length, 0, "0 unpaired");
  const one = scheduleFirstRoundFromClubs(["beta"]);
  assert.equal(one.pairings.length, 0, "1 club no match");
  assert.equal(one.unpairedClubIds[0], "beta", "1 unpaired");
  const two = scheduleFirstRoundFromClubs(["zeta", "alpha"]);
  assert.equal(two.pairings.length, 1, "2 → 1 pair");
  assert.equal(two.pairings[0].clubAId, "alpha", "canonical a");
  assert.equal(two.pairings[0].clubBId, "zeta", "canonical b");
  assert.equal(two.pairings[0].round, FIRST_TOURNAMENT_ROUND, "round 1");
  assert.equal(two.pairings[0].status, "SCHEDULED", "scheduled");
  assert.equal(two.unpairedClubIds.length, 0, "even");
  const three = scheduleFirstRoundFromClubs(["c", "a", "b"]);
  assert.equal(three.pairings.length, 1, "3 → 1 pair");
  assert.equal(three.pairings[0].clubAId, "a", "a");
  assert.equal(three.pairings[0].clubBId, "b", "b");
  assert.equal(three.unpairedClubIds[0], "c", "odd leftover");
  const four = scheduleFirstRoundFromClubs(["d", "a", "c", "b"]);
  assert.equal(four.pairings.length, 2, "4 → 2");
  assert.equal(four.pairings[0].slot, 0, "slot 0");
  assert.equal(four.pairings[1].slot, 1, "slot 1");
  assert.equal(four.pairings[0].clubAId, "a", "pair0 a");
  assert.equal(four.pairings[0].clubBId, "b", "pair0 b");
  assert.equal(four.pairings[1].clubAId, "c", "pair1 a");
  assert.equal(four.pairings[1].clubBId, "d", "pair1 b");
});

const MATCH_AB = {
  id: "m1",
  competition_id: "t1",
  round: 1,
  slot: 0,
  club_a_id: "alpha",
  club_b_id: "beta",
  status: "SCHEDULED",
};

test("score : pas de résultat → pas encore joué, jamais 0-0 inventé", () => {
  assert.equal(tournamentMatchScoreLabel(MATCH_AB, []), TOURNAMENT_COPY.notPlayed, "empty");
  assert.false(tournamentMatchIsPlayed(MATCH_AB, []), "not played");
  assert.equal(tournamentMatchWinnerId(MATCH_AB, []), null, "no winner");
  const unlinked = [
    {
      club_id: "alpha",
      opponent_club_id: null,
      competition_id: "t1",
      outcome: "WIN",
      our_score: 0,
      opponent_score: 0,
    },
  ];
  assert.equal(tournamentMatchScoreLabel(MATCH_AB, unlinked), TOURNAMENT_COPY.notPlayed, "unlinked 0-0 ignored");
  const otherComp = [
    {
      club_id: "alpha",
      opponent_club_id: "beta",
      competition_id: "other",
      outcome: "WIN",
      our_score: 3,
      opponent_score: 1,
    },
  ];
  assert.equal(tournamentMatchScoreLabel(MATCH_AB, otherComp), TOURNAMENT_COPY.notPlayed, "wrong tournament");
  const played = [
    {
      club_id: "alpha",
      opponent_club_id: "beta",
      competition_id: "t1",
      outcome: "WIN",
      our_score: 2,
      opponent_score: 1,
    },
  ];
  assert.equal(tournamentMatchScoreLabel(MATCH_AB, played), "2 — 1", "linked score");
  assert.true(tournamentMatchIsPlayed(MATCH_AB, played), "played from result");
  assert.equal(tournamentMatchWinnerId(MATCH_AB, played), "alpha", "winner recorder");
  const fromAway = [
    {
      club_id: "beta",
      opponent_club_id: "alpha",
      competition_id: "t1",
      outcome: "LOSS",
      our_score: 0,
      opponent_score: 4,
    },
  ];
  assert.equal(tournamentMatchScoreLabel(MATCH_AB, fromAway), "4 — 0", "flipped to A-B");
  assert.equal(tournamentMatchWinnerId(MATCH_AB, fromAway), "alpha", "winner from LOSS");
  const draw = [
    {
      club_id: "alpha",
      opponent_club_id: "beta",
      competition_id: "t1",
      outcome: "DRAW",
      our_score: 0,
      opponent_score: 0,
    },
  ];
  assert.equal(tournamentMatchScoreLabel(MATCH_AB, draw), "0 — 0", "real played 0-0");
  assert.equal(tournamentMatchWinnerId(MATCH_AB, draw), null, "draw no winner");
});

test("PLAYED status sans résultat lié ≠ score ; progression seulement vainqueurs réels", () => {
  const markedPlayed = { ...MATCH_AB, status: "PLAYED" };
  assert.equal(tournamentMatchScoreLabel(markedPlayed, []), TOURNAMENT_COPY.notPlayed, "status alone no score");
  assert.false(tournamentMatchIsPlayed(markedPlayed, []), "status alone not played");
  const m2 = {
    id: "m2",
    competition_id: "t1",
    round: 1,
    slot: 1,
    club_a_id: "gamma",
    club_b_id: "delta",
    status: "SCHEDULED",
  };
  const results = [
    {
      club_id: "alpha",
      opponent_club_id: "beta",
      competition_id: "t1",
      outcome: "WIN",
      our_score: 1,
      opponent_score: 0,
    },
    {
      club_id: "gamma",
      opponent_club_id: "delta",
      competition_id: "t1",
      outcome: "DRAW",
      our_score: 2,
      opponent_score: 2,
    },
  ];
  const qualified = tournamentQualifiedClubIds([MATCH_AB, m2], results);
  assert.equal(qualified.length, 1, "draw excluded");
  assert.equal(qualified[0], "alpha", "only winner");
  assert.equal(tournamentQualifiedClubIds([MATCH_AB, m2], []).length, 0, "none played");
});

test("bracket uniquement si des rows existent ; unpaired hors tableau", () => {
  assert.false(canShowTournamentBracket([]), "empty");
  assert.true(canShowTournamentBracket([MATCH_AB]), "real row");
  const unpaired = unpairedRegisteredClubIds(["alpha", "beta", "gamma"], [MATCH_AB]);
  assert.equal(unpaired.length, 1, "one leftover");
  assert.equal(unpaired[0], "gamma", "gamma");
});

const WIN_AB = {
  club_id: "alpha",
  opponent_club_id: "beta",
  competition_id: "t1",
  outcome: "WIN" as const,
  our_score: 2,
  opponent_score: 0,
};
const WIN_CD = {
  club_id: "gamma",
  opponent_club_id: "delta",
  competition_id: "t1",
  outcome: "WIN" as const,
  our_score: 1,
  opponent_score: 0,
};
const MATCH_CD = {
  id: "m2",
  competition_id: "t1",
  round: 1,
  slot: 1,
  club_a_id: "delta",
  club_b_id: "gamma",
  status: "SCHEDULED",
};

test("tour suivant : vainqueurs PLAYED + unpaired du pool ; unplayed/nul bloquent", () => {
  const four = nextRoundClubIds(
    [MATCH_AB, MATCH_CD],
    ["alpha", "beta", "gamma", "delta"],
    [WIN_AB, WIN_CD]
  );
  assert.equal(four.ok, true, "4 clubs both played");
  if (four.ok) {
    assert.equal(four.clubIds.length, 2, "two winners");
    assert.true(four.clubIds.includes("alpha"), "alpha");
    assert.true(four.clubIds.includes("gamma"), "gamma");
  }
  const incomplete = nextRoundClubIds([MATCH_AB, MATCH_CD], ["alpha", "beta", "gamma", "delta"], [WIN_AB]);
  assert.equal(incomplete.ok, false, "one unplayed");
  if (!incomplete.ok) assert.equal(incomplete.reason, "round_incomplete", "unplayed reason");
  const draw = nextRoundClubIds(
    [MATCH_AB],
    ["alpha", "beta"],
    [
      {
        club_id: "alpha",
        opponent_club_id: "beta",
        competition_id: "t1",
        outcome: "DRAW",
        our_score: 1,
        opponent_score: 1,
      },
    ]
  );
  assert.equal(draw.ok, false, "draw blocks");
  if (!draw.ok) assert.equal(draw.reason, "draw_blocks", "draw reason");
  const odd = nextRoundClubIds([MATCH_AB], ["alpha", "beta", "gamma"], [WIN_AB]);
  assert.equal(odd.ok, true, "winner + unpaired");
  if (odd.ok) {
    assert.equal(odd.clubIds.length, 2, "A + C");
    assert.true(odd.clubIds.includes("alpha"), "winner");
    assert.true(odd.clubIds.includes("gamma"), "unpaired advances to play, not as fake winner");
  }
});

test("vainqueur du tournoi : finale persistée 1 match / pool 2 / résultat PLAYED", () => {
  const r1 = [MATCH_AB, MATCH_CD];
  const poolR1 = [
    { competition_id: "t1", round: 1, club_id: "alpha" },
    { competition_id: "t1", round: 1, club_id: "beta" },
    { competition_id: "t1", round: 1, club_id: "gamma" },
    { competition_id: "t1", round: 1, club_id: "delta" },
  ];
  assert.equal(tournamentChampionClubId(r1, [WIN_AB, WIN_CD], poolR1), null, "semi not final");
  const final = {
    id: "m3",
    competition_id: "t1",
    round: 2,
    slot: 0,
    club_a_id: "alpha",
    club_b_id: "gamma",
    status: "SCHEDULED",
  };
  const poolR2 = [
    { competition_id: "t1", round: 2, club_id: "alpha" },
    { competition_id: "t1", round: 2, club_id: "gamma" },
  ];
  assert.equal(tournamentChampionClubId([final], [], poolR2), null, "final unplayed");
  const finalWin = {
    club_id: "alpha",
    opponent_club_id: "gamma",
    competition_id: "t1",
    outcome: "WIN",
    our_score: 3,
    opponent_score: 1,
  };
  assert.equal(tournamentChampionClubId([final], [finalWin], poolR2), "alpha", "champion");
  const threePool = [
    { competition_id: "t1", round: 1, club_id: "alpha" },
    { competition_id: "t1", round: 1, club_id: "beta" },
    { competition_id: "t1", round: 1, club_id: "gamma" },
  ];
  assert.equal(tournamentChampionClubId([MATCH_AB], [WIN_AB], threePool), null, "3-club R1 not a final");
});

test("canScheduleRound : 1er tour puis tour suivant depuis PLAYED, pas de décor", () => {
  const first = canScheduleRound({
    actorId: "u",
    createdBy: "u",
    status: "OPEN",
    kind: "TOURNAMENT",
    registeredClubIds: ["alpha", "beta", "gamma", "delta"],
    matches: [],
    results: [],
    roundClubs: [],
  });
  assert.equal(first.ok, true, "first");
  if (first.ok) {
    assert.equal(first.intent, "first", "intent first");
    assert.equal(first.round, FIRST_TOURNAMENT_ROUND, "r1");
  }
  const wait = canScheduleRound({
    actorId: "u",
    createdBy: "u",
    status: "OPEN",
    kind: "TOURNAMENT",
    registeredClubIds: ["alpha", "beta", "gamma", "delta"],
    matches: [MATCH_AB, MATCH_CD],
    results: [WIN_AB],
    roundClubs: [
      { competition_id: "t1", round: 1, club_id: "alpha" },
      { competition_id: "t1", round: 1, club_id: "beta" },
      { competition_id: "t1", round: 1, club_id: "gamma" },
      { competition_id: "t1", round: 1, club_id: "delta" },
    ],
  });
  assert.equal(wait.ok, false, "wait unplayed");
  if (!wait.ok) assert.equal(wait.reason, "round_incomplete", "incomplete");
  const next = canScheduleRound({
    actorId: "u",
    createdBy: "u",
    status: "OPEN",
    kind: "TOURNAMENT",
    registeredClubIds: ["alpha", "beta", "gamma", "delta"],
    matches: [MATCH_AB, MATCH_CD],
    results: [WIN_AB, WIN_CD],
    roundClubs: [
      { competition_id: "t1", round: 1, club_id: "alpha" },
      { competition_id: "t1", round: 1, club_id: "beta" },
      { competition_id: "t1", round: 1, club_id: "gamma" },
      { competition_id: "t1", round: 1, club_id: "delta" },
    ],
  });
  assert.equal(next.ok, true, "next ok");
  if (next.ok) {
    assert.equal(next.intent, "next", "intent next");
    assert.equal(next.round, 2, "r2");
    assert.equal(next.clubIds.length, 2, "two finalists");
  }
});

test("détail /tournaments/[id] ; liste si id absent", () => {
  assert.equal(tournamentDetailHref("t-1"), "/tournaments/t-1", "detail");
  assert.equal(tournamentDetailHref(""), "/tournaments", "empty");
  assert.equal(tournamentDetailHref(null), "/tournaments", "null");
});

test("copy FR virtuel Pro Clubs, jamais IRL / pas de 0-0 inventé dans le vide", () => {
  assert.true(TOURNAMENT_COPY.subtitle.includes("EA SPORTS FC 27 Pro Clubs"), "fc27");
  assert.true(TOURNAMENT_COPY.needTwoClubs.includes("deux clubs"), "two clubs");
  assert.equal(TOURNAMENT_COPY.notPlayed, "pas encore joué", "unplayed");
  assert.false(TOURNAMENT_COPY.notPlayed.includes("0-0"), "no 0-0 copy");
  assert.false(TOURNAMENT_COPY.bracketEmpty.includes("0-0"), "no fake score empty");
  assert.true(TOURNAMENT_COPY.bracketEmpty.includes("enregistrées"), "persisted only");
  assert.true(TOURNAMENT_COPY.championEmpty.includes("finale"), "champion empty");
  assert.false(TOURNAMENT_COPY.championEmpty.includes("0-0"), "no fake champion score");
  assert.equal(TOURNAMENT_STATUS_LABELS.OPEN, "Ouvert", "open label");
  assert.false(TOURNAMENT_COPY.subtitle.includes("%"), "no percent");
  assert.equal(TOURNAMENT_COPY.linkedResultCta, "Voir le tournoi", "cta after result");
  assert.equal(TOURNAMENT_COPY.kindLabel, "Tournoi", "picker kind");
});

test("SQL 0029 : kind + tournament_matches ; refuse table tournaments dupliquée / scores / season_stats", () => {
  const valid = `
    alter table public.competitions add column if not exists kind text not null default 'COMPETITION';
    check (kind in ('COMPETITION', 'TOURNAMENT'))
    create table if not exists public.tournament_matches (
      club_a_id uuid, club_b_id uuid, round int, slot int, status text
    );
    check (status in ('SCHEDULED', 'PLAYED'))
    constraint tournament_matches_clubs_distinct
    grant all privileges on public.tournament_matches to service_role
    tournament_matches_select_open_or_own
    and kind = 'COMPETITION'
    tournament_match_insert_scheduled_only
    tournament_matches_mark_played
    create table if not exists public.tournament_round_clubs
  `;
  assert.equal(tournamentV1SqlIssues(valid).join(" | "), "", "contrat 0029");
  const withDup = `${valid}\ncreate table if not exists public.tournaments (id uuid);`;
  assert.true(tournamentV1SqlIssues(withDup).some((i) => i.startsWith("interdit:")), "no duplicate table");
  const withStats = `${valid}\nseason_stats`;
  assert.true(tournamentV1SqlIssues(withStats).some((i) => i.includes("season_stats")), "no season_stats");
  const withScores = `${valid}\nour_score int,\nopponent_score int`;
  assert.true(tournamentV1SqlIssues(withScores).some((i) => i.includes("our_score") || i.includes("opponent_score")), "no scores on matches");
});

console.log(`\n${passed} tests OK`);

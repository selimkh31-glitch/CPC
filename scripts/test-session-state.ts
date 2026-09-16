/**
 * Tests de lib/sessionState.ts — mapping honnête LIVE TTL vs feuille de match,
 * effectif club_members + slot_assignments. Sans réseau.
 *
 * Lancer : npx tsx scripts/test-session-state.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import {
  benchMembers,
  canMutateClub,
  clubSessionSnapshot,
  filledSlotCount,
  formatNeededPositionsLine,
  liveRecruitmentTitle,
  mapLiveRecruitment,
  mapMatchSheet,
  matchSheetTitle,
  rosterFillLabel,
  startingUserIds,
  canPressEmptyFormationSlot,
  neededPositionsFromEmptySlots,
  type LiveSessionFields,
} from "../lib/sessionState";
import type { ClubMemberRow, MatchCheckinRow, SlotAssignmentRow } from "../lib/types";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown, label: string) {
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

const NOW = Date.parse("2026-08-24T12:00:00.000Z");

function session(overrides: Partial<LiveSessionFields> = {}): LiveSessionFields {
  return {
    id: "s1",
    is_live: true,
    expires_at: "2026-08-24T13:00:00.000Z",
    needed_positions: ["ST", "CM"],
    note: "On lance",
    ...overrides,
  };
}

function checkin(overrides: Partial<MatchCheckinRow> = {}): MatchCheckinRow {
  return {
    id: "ck1",
    club_id: "c1",
    session_id: "s1",
    formation_id: "4-3-3",
    launched_at: "2026-08-24T11:50:00.000Z",
    launched_by: "owner",
    created_at: "2026-08-24T11:50:00.000Z",
    ...overrides,
  };
}

console.log("lib/sessionState.ts — LIVE vs feuille de match (champs réels)");

test("mapLiveRecruitment — inactif si is_live false / expiry passée / expires_at null", () => {
  assert.equal(mapLiveRecruitment([session({ is_live: false })], NOW).active, false, "flag off");
  assert.equal(mapLiveRecruitment([session({ expires_at: "2026-08-24T11:00:00.000Z" })], NOW).active, false, "expiré");
  assert.equal(mapLiveRecruitment([session({ expires_at: null })], NOW).active, false, "sans TTL");
});

test("mapLiveRecruitment — actif seulement si flag + TTL futur, id/postes/note réels", () => {
  const live = mapLiveRecruitment([session()], NOW);
  assert.equal(live.active, true, "actif");
  if (!live.active) throw new Error("expected active");
  assert.equal(live.sessionId, "s1", "id");
  assert.equal(live.expiresAt, "2026-08-24T13:00:00.000Z", "ttl");
  assert.deepEqual(live.neededPositions, ["ST", "CM"], "postes");
  assert.equal(live.note, "On lance", "note");
});

test("mapMatchSheet — null / absent = pas de match lancé (pas d'enum inventé)", () => {
  assert.deepEqual(mapMatchSheet(null), { active: false }, "null");
  assert.deepEqual(mapMatchSheet(undefined), { active: false }, "undefined");
});

test("mapMatchSheet — check-in actif = match lancé, champs persistés uniquement", () => {
  const match = mapMatchSheet(checkin());
  assert.equal(match.active, true, "actif");
  if (!match.active) throw new Error("expected active");
  assert.equal(match.checkinId, "ck1", "id");
  assert.equal(match.launchedAt, "2026-08-24T11:50:00.000Z", "launched_at");
  assert.equal(match.formationId, "4-3-3", "formation");
  assert.equal(match.sessionId, "s1", "session_id");
});

test("clubSessionSnapshot — LIVE et match sont indépendants (pas un statut OPEN/FULL)", () => {
  const both = clubSessionSnapshot([session()], checkin(), NOW);
  assert.equal(both.live.active, true, "live on");
  assert.equal(both.match.active, true, "match on");
  const liveOnly = clubSessionSnapshot([session()], null, NOW);
  assert.equal(liveOnly.live.active, true, "live only");
  assert.equal(liveOnly.match.active, false, "pas de check-in");
  const neither = clubSessionSnapshot([session({ is_live: false })], null, NOW);
  assert.equal(neither.live.active, false, "hors ligne");
  assert.equal(neither.match.active, false, "pas de match");
});

test("titres FR — Recrutement LIVE / Hors ligne / Match lancé, jamais OPEN ni FULL", () => {
  assert.equal(liveRecruitmentTitle({ active: false }), "Hors ligne", "offline");
  assert.equal(
    liveRecruitmentTitle({
      active: true,
      sessionId: "s1",
      expiresAt: "x",
      neededPositions: ["ST"],
      note: null,
    }),
    "Recrutement LIVE",
    "live"
  );
  assert.equal(matchSheetTitle({ active: false }), "Pas de match lancé", "no match");
  assert.equal(
    matchSheetTitle({
      active: true,
      checkinId: "ck1",
      launchedAt: "x",
      formationId: null,
      sessionId: "s1",
    }),
    "Match lancé",
    "match"
  );
  const blob = `${liveRecruitmentTitle({ active: false })}${matchSheetTitle({ active: false })}`;
  assert.equal(blob.includes("OPEN") || blob.includes("FULL"), false, "pas d'enum inventé");
});

test("formatNeededPositionsLine — une ligne ; vide -> null", () => {
  assert.equal(formatNeededPositionsLine([]), null, "vide");
  assert.equal(formatNeededPositionsLine(null), null, "null");
  assert.equal(formatNeededPositionsLine(["ST", "CM"]), "ST · CM", "codes");
});

test("canMutateClub — OWNER/MANAGER seulement", () => {
  assert.equal(canMutateClub("OWNER"), true, "owner");
  assert.equal(canMutateClub("MANAGER"), true, "manager");
  assert.equal(canMutateClub("MEMBER"), false, "member");
  assert.equal(canMutateClub(null), false, "null");
});

console.log("lib/sessionState.ts — effectif slot_assignments + club_members");

test("banc = membres sans slot_assignment ; filled = nombre de lignes slots", () => {
  const members: ClubMemberRow[] = [
    { id: "m1", club_id: "c1", user_id: "u1", role: "OWNER", joined_at: "a", matches_played_count: 0, strike_count: 0, active_departure_request_id: null },
    { id: "m2", club_id: "c1", user_id: "u2", role: "MEMBER", joined_at: "b", matches_played_count: 0, strike_count: 0, active_departure_request_id: null },
    { id: "m3", club_id: "c1", user_id: "u3", role: "MEMBER", joined_at: "c", matches_played_count: 0, strike_count: 0, active_departure_request_id: null },
  ];
  const assignments: SlotAssignmentRow[] = [
    { id: "a1", club_id: "c1", slot_id: "ST", user_id: "u2", assigned_at: "t" },
  ];
  assert.deepEqual([...startingUserIds(assignments)], ["u2"], "starters");
  assert.deepEqual(
    benchMembers(members, assignments).map((m) => m.user_id),
    ["u1", "u3"],
    "banc"
  );
  assert.equal(filledSlotCount(assignments), 1, "filled");
  assert.equal(filledSlotCount([]), 0, "vide");
  assert.equal(rosterFillLabel(1), "1/11 titulaires", "label");
  assert.equal(rosterFillLabel(11), "11/11 titulaires", "complet — compte, pas FULL");
});

test("canPressEmptyFormationSlot — pas de CTA morte sans handler", () => {
  assert.equal(canPressEmptyFormationSlot(true, true), true, "owner + handler");
  assert.equal(canPressEmptyFormationSlot(true, false), false, "sans handler");
  assert.equal(canPressEmptyFormationSlot(false, true), false, "lecture seule");
  assert.equal(canPressEmptyFormationSlot(false, false), false, "ni l'un ni l'autre");
});

test("neededPositionsFromEmptySlots — postes vides du terrain, doublons conservés", () => {
  assert.deepEqual(neededPositionsFromEmptySlots(null, []), [], "pas de formation");
  const empty433 = neededPositionsFromEmptySlots("4-3-3", []);
  assert.equal(empty433.length, 11, "11 vacants");
  assert.equal(empty433.filter((p) => p === "CB").length, 2, "deux CB");
  const filled: SlotAssignmentRow[] = [
    { id: "a1", club_id: "c1", slot_id: "GK", user_id: "u1", assigned_at: "t" },
    { id: "a2", club_id: "c1", slot_id: "ST", user_id: "u2", assigned_at: "t" },
  ];
  const needed = neededPositionsFromEmptySlots("4-3-3", filled);
  assert.equal(needed.includes("GK"), false, "GK pris");
  assert.equal(needed.includes("ST"), false, "ST pris");
  assert.equal(needed.filter((p) => p === "CB").length, 2, "CB toujours doublon");
  assert.equal(needed.length, 9, "9 vacants");
});

test("feuille : plus de chrome Banc dans ClubLiveFeuille / ClubHome", () => {
  const feuille = readFileSync(`${process.cwd()}/components/club/ClubLiveFeuille.tsx`, "utf8");
  const home = readFileSync(`${process.cwd()}/components/club/ClubHome.tsx`, "utf8");
  assert.equal(feuille.includes(">Banc<"), false, "feuille no Banc");
  assert.equal(home.includes(">Banc<"), false, "home no Banc");
  assert.equal(feuille.includes("benchMembers"), false, "feuille no bench UI helper");
  assert.equal(home.includes("benchMembers"), false, "home no bench UI helper");
});

test("ClubHome : pas canApplyOnClubPitch / apply-on-slot ; claim après membership", () => {
  const home = readFileSync(`${process.cwd()}/components/club/ClubHome.tsx`, "utf8");
  const feuille = readFileSync(`${process.cwd()}/components/club/ClubLiveFeuille.tsx`, "utf8");
  assert.equal(home.includes("canApplyOnClubPitch"), false, "no visitor apply helper");
  assert.equal(home.includes("useApply"), false, "no apply");
  assert.equal(home.includes("useClaimSlot"), true, "claim");
  assert.equal(home.includes("Rejoindre le club"), true, "join CTA");
  assert.equal(home.includes("interactive={isMember}"), true, "members can tap empty");
  assert.equal(feuille.includes("/player-search?clubId="), true, "manager search");
});

console.log(`\n${passed} test(s) passés.`);

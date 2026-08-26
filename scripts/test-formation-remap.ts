/**
 * Tests remapSlotAssignments + wiring membership-first / formation sans wipe.
 * Lancer : npx tsx scripts/test-formation-remap.ts
 */
import { remapSlotAssignments, FORMATIONS, type FormationId } from "../lib/formations";
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";

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

function byUser(rows: { slotId: string; userId: string }[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.userId, row.slotId]));
}

function fullRoster(formationId: FormationId): { slotId: string; userId: string }[] {
  return FORMATIONS[formationId].map((slot, i) => ({ slotId: slot.slotId, userId: `u${i}-${slot.slotId}` }));
}

console.log("lib/formations.ts — remapSlotAssignments");

test("même formation : slotId conservés, rien droppé", () => {
  const roster = fullRoster("4-3-3");
  const out = remapSlotAssignments(roster, "4-3-3", "4-3-3");
  assert.equal(out.length, 11, "11");
  assert.deepEqual(byUser(out), byUser(roster), "identity");
});

test("slotId identique gagne (LCB/RCB 4-3-3 → 4-4-2)", () => {
  const out = remapSlotAssignments(
    [
      { slotId: "LCB", userId: "left" },
      { slotId: "RCB", userId: "right" },
    ],
    "4-3-3",
    "4-4-2"
  );
  assert.deepEqual(byUser(out), { left: "LCB", right: "RCB" }, "keep slotId");
});

test("même code poste exact sur un slot libre (ST 4-3-3 → LST 4-4-2)", () => {
  const out = remapSlotAssignments([{ slotId: "ST", userId: "striker" }], "4-3-3", "4-4-2");
  assert.deepEqual(byUser(out), { striker: "LST" }, "ST → first unused ST");
});

test("LW n'est jamais mappé vers LM (codes exacts seulement)", () => {
  const out = remapSlotAssignments(
    [
      { slotId: "LW", userId: "winger" },
      { slotId: "RW", userId: "right" },
    ],
    "4-3-3",
    "4-4-2"
  );
  const map = byUser(out);
  assert.equal("winger" in map, false, "LW dropped");
  assert.equal("right" in map, false, "RW dropped");
  assert.equal(out.some((row) => row.slotId === "LM"), false, "no LW→LM");
});

test("LM 4-4-2 → 4-3-3 n'est pas recyclé en LW", () => {
  const out = remapSlotAssignments([{ slotId: "LM", userId: "wide" }], "4-4-2", "4-3-3");
  assert.equal(out.length, 0, "LM ≠ LW");
});

test("LAM (LM) 4-2-3-1 → 4-3-3 : pas de glissement vers LW", () => {
  const out = remapSlotAssignments([{ slotId: "LAM", userId: "wide" }], "4-2-3-1", "4-3-3");
  assert.equal(out.length, 0, "LM ≠ LW");
});

test("CDM 4-3-3 → 4-2-3-1 : poste CDM recyclé sur LDM (premier libre)", () => {
  const out = remapSlotAssignments([{ slotId: "CDM", userId: "pivot" }], "4-3-3", "4-2-3-1");
  assert.deepEqual(byUser(out), { pivot: "LDM" }, "CDM position");
});

test("surnombre : 3 CB (3-5-2) → 2 CB (4-3-3), le slotId CB sans équivalent est droppé", () => {
  const out = remapSlotAssignments(
    [
      { slotId: "LCB", userId: "a" },
      { slotId: "CB", userId: "b" },
      { slotId: "RCB", userId: "c" },
    ],
    "3-5-2",
    "4-3-3"
  );
  assert.deepEqual(byUser(out), { a: "LCB", c: "RCB" }, "keep LCB/RCB, drop extra CB");
  assert.equal(out.some((row) => row.userId === "b"), false, "b dropped");
});

test("4-3-3 complet → 4-4-2 : keep slotId + ST→LST, drop CDM/LW/RW", () => {
  const roster = fullRoster("4-3-3");
  const out = remapSlotAssignments(roster, "4-3-3", "4-4-2");
  const map = byUser(out);
  assert.equal(map["u0-GK"], "GK", "GK");
  assert.equal(map["u1-LB"], "LB", "LB");
  assert.equal(map["u2-LCB"], "LCB", "LCB");
  assert.equal(map["u3-RCB"], "RCB", "RCB");
  assert.equal(map["u4-RB"], "RB", "RB");
  assert.equal(map["u6-LCM"], "LCM", "LCM");
  assert.equal(map["u7-RCM"], "RCM", "RCM");
  assert.equal(map["u9-ST"], "LST", "ST→LST");
  assert.equal("u5-CDM" in map, false, "CDM dropped");
  assert.equal("u8-LW" in map, false, "LW dropped");
  assert.equal("u10-RW" in map, false, "RW dropped");
  assert.equal(out.length, 8, "8 kept");
});

test("remap ne touche pas club_members — drop d'assignation seulement", () => {
  const src = readFileSync(`${process.cwd()}/lib/formations.ts`, "utf8");
  assert.true(src.includes("sans toucher à club_members"), "doc");
  assert.false(src.includes('.from("club_members")'), "no members write");
});

console.log("source — join membership-first, claim-slot, formation sans wipe");

test("useUpdateFormation remap, pas de wipe-all slot_assignments", () => {
  const hooks = readFileSync(`${process.cwd()}/lib/hooks/useClubs.ts`, "utf8");
  assert.true(hooks.includes("remapSlotAssignments"), "uses remap");
  assert.true(hooks.includes("neededPositionsFromEmptySlots"), "sync empty slots");
  assert.true(hooks.includes("findActiveLiveSession"), "LIVE session");
  assert.false(/from\("slot_assignments"\)\.delete\(\)\.eq\("club_id", clubId\);/.test(hooks), "no wipe-all");
  assert.true(hooks.includes('.in("user_id", dropOrMoveUserIds)'), "delete moved/dropped only");
});

test("FormationSelector copy : membres restent, pas un kick", () => {
  const sel = readFileSync(`${process.cwd()}/components/club/FormationSelector.tsx`, "utf8");
  assert.true(sel.includes("Les membres restent dans le club"), "copy");
  assert.true(sel.includes("même poste exact"), "exact position");
  assert.false(sel.includes("devront être réassignés"), "old wipe copy gone");
  assert.false(sel.includes('style: "destructive"'), "not destructive");
});

test("join-live-club : auth, LIVE, block, MEMBER sans slot, already_has_active_club", () => {
  const edge = readFileSync(`${process.cwd()}/supabase/functions/join-live-club/index.ts`, "utf8");
  assert.true(edge.includes("getCallingUser"), "auth");
  assert.true(edge.includes("rejectIfBlocked"), "block");
  assert.true(edge.includes("alreadyMember"), "no-op member");
  assert.true(edge.includes('role: "MEMBER"'), "MEMBER");
  assert.true(edge.includes('["MEMBER", "MANAGER"]'), "one active club");
  assert.true(edge.includes("Tu es déjà engagé avec un autre club."), "409 copy");
  assert.true(edge.includes("Cette session n'est plus disponible."), "LIVE required");
  assert.true(edge.includes("notifyUser"), "notify owner");
  assert.false(edge.includes("slot_assignments"), "no slot on join");
  assert.false(edge.includes('"apply"'), "not apply");
});

test("claim-slot : membre seulement, insert slot, pas club_members", () => {
  const edge = readFileSync(`${process.cwd()}/supabase/functions/claim-slot/index.ts`, "utf8");
  assert.true(edge.includes("getCallingUser"), "auth");
  assert.true(edge.includes("Rejoins le club avant de prendre un poste."), "must be member");
  assert.true(edge.includes("slot_assignments"), "writes slots");
  assert.true(edge.includes("Tu as déjà un poste sur cette feuille."), "one slot");
  assert.true(edge.includes("Ce poste vient d'être pris."), "vacant");
  assert.true(edge.includes("needed_positions"), "sync LIVE need");
  assert.false(edge.includes('role: "MEMBER"'), "does not create membership");
});

test("hooks + UI : Rejoindre = join-live-club, pas apply", () => {
  const hook = readFileSync(`${process.cwd()}/lib/hooks/useJoinLiveClub.ts`, "utf8");
  const card = readFileSync(`${process.cwd()}/components/live/LiveClubCard.tsx`, "utf8");
  const home = readFileSync(`${process.cwd()}/components/club/ClubHome.tsx`, "utf8");
  const page = readFileSync(`${process.cwd()}/app/club/[id].tsx`, "utf8");
  const feuille = readFileSync(`${process.cwd()}/components/club/ClubLiveFeuille.tsx`, "utf8");
  const toml = readFileSync(`${process.cwd()}/supabase/config.toml`, "utf8");
  const apply = readFileSync(`${process.cwd()}/lib/hooks/useApply.ts`, "utf8");
  assert.true(hook.includes('"join-live-club"'), "join hook");
  assert.true(hook.includes('"claim-slot"'), "claim hook");
  assert.true(card.includes("JoinLiveClubButton"), "card join");
  assert.true(card.includes('label="Rejoindre"'), "Rejoindre");
  assert.false(card.includes("useApply"), "card no apply");
  assert.false(card.includes("clubPublicHref"), "card no public href");
  assert.true(home.includes("JoinLiveClubButton"), "home join");
  assert.true(home.includes('label="Rejoindre le club"'), "home CTA");
  assert.true(home.includes("useClaimSlot"), "home claim");
  assert.false(home.includes("useApply"), "home no apply");
  assert.false(home.includes("canApplyOnClubPitch"), "no visitor apply helper");
  assert.true(page.includes("JoinLiveClubButton"), "public join");
  assert.false(page.includes("ApplyForm"), "public no ApplyForm");
  assert.true(feuille.includes("/player-search?clubId="), "manager search stays");
  assert.false(feuille.includes("useClaimSlot"), "manager does not self-claim on empty");
  assert.true(toml.includes("[functions.join-live-club]"), "toml join");
  assert.true(toml.includes("[functions.claim-slot]"), "toml claim");
  assert.true(apply.includes('"apply"'), "apply kept for old applications");
});

console.log(`\n${passed} test(s) passés.`);

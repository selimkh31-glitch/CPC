/**
 * Tests des slots numérotés (CB1 CB2 CB3) — pas de collapse unique.
 * Lancer : npx tsx scripts/test-numbered-positions.ts
 */
import {
  formatNeededPositionsLine,
  neededPositionsFromEmptySlots,
  numberedPositionSlots,
  uniquePositionCodes,
} from "../lib/sessionState";
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

console.log("lib/sessionState.ts — numberedPositionSlots");

test("un seul code → CB, pas CB1", () => {
  assert.deepEqual(numberedPositionSlots(["CB"]), [{ slot: "CB", code: "CB" }], "once");
  assert.equal(formatNeededPositionsLine(["CB"]), "CB", "line");
});

test("trois CB → CB1 CB2 CB3, chaque slot conservé", () => {
  const slots = numberedPositionSlots(["CB", "CB", "CB"]);
  assert.equal(slots.length, 3, "keep 3");
  assert.deepEqual(
    slots,
    [
      { slot: "CB1", code: "CB" },
      { slot: "CB2", code: "CB" },
      { slot: "CB3", code: "CB" },
    ],
    "numbered"
  );
  assert.equal(formatNeededPositionsLine(["CB", "CB", "ST"]), "CB1 · CB2 · ST", "mixed");
});

test("formatNeededPositionsLine — codes, pas de libellés FR", () => {
  assert.equal(formatNeededPositionsLine([]), null, "vide");
  assert.equal(formatNeededPositionsLine(["ST", "CAM"]), "ST · CAM", "ST CAM");
  assert.equal(formatNeededPositionsLine(["GK"]), "GK", "GK");
  assert.false((formatNeededPositionsLine(["ST", "CAM"]) ?? "").includes("Attaquant"), "not French");
});

test("neededPositionsFromEmptySlots — raw CB,CB pour le matching", () => {
  const empty433 = neededPositionsFromEmptySlots("4-3-3", []);
  assert.equal(empty433.filter((p) => p === "CB").length, 2, "two raw CB");
  assert.false(empty433.includes("CB1" as (typeof empty433)[number]), "not CB1");
  const five = neededPositionsFromEmptySlots("5-3-2", []);
  assert.equal(five.filter((p) => p === "CB").length, 3, "three raw CB");
});

test("uniquePositionCodes — ApplyForm une fois par code", () => {
  assert.deepEqual(uniquePositionCodes(["CB", "CB", "CB", "ST"]), ["CB", "ST"], "unique");
});

test("source — chips key=item.slot ; page publique slim", () => {
  const page = readFileSync(`${process.cwd()}/app/club/[id].tsx`, "utf8");
  const apply = readFileSync(`${process.cwd()}/components/club/ApplyForm.tsx`, "utf8");
  assert.true(page.includes("numberedPositionSlots"), "slots helper");
  assert.true(page.includes("key={item.slot}"), "chip key");
  assert.true(page.includes("ApplyForm"), "apply");
  assert.true(page.includes("isMember"), "member gate");
  assert.true(page.includes("match-sheet"), "sheet href");
  assert.true(page.includes("{isMember ?"), "sheet if member");
  assert.true(page.includes("isMember && !isSelf"), "dm members only");
  assert.true(page.includes("showMatchHistory"), "hide empty history");
  assert.true(page.includes("buildClubLiveRowMeta"), "compact header meta");
  assert.false(page.includes("@/components/club/ClubCard"), "no ClubCard");
  assert.false(page.includes("@/components/player/PlayerCard"), "no PlayerCard");
  assert.false(page.includes("eaUnlinked"), "no EA dump");
  assert.false(page.includes('variant="full"'), "no full card");
  assert.true(apply.includes("uniquePositionCodes"), "apply unique codes");
});

console.log(`\n${passed} test(s) passés.`);

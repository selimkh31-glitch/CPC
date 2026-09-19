/**
 * Tests de lib/clubLiveRow.ts — langue code, rythme, forme V/N/D, effectif.
 * Lancer : npx tsx scripts/test-club-live-row.ts
 */
import {
  LIVE_ROW_LEVEL,
  buildClubLiveRowMeta,
  formatLiveRowMeta,
  liveRowLanguage,
  liveRowLevel,
  parseClubForm,
  resolveClubForm,
  resolveMemberCount,
} from "../lib/clubLiveRow";
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

console.log("lib/clubLiveRow.ts");

test("liveRowLanguage — premier code, pas Français", () => {
  assert.equal(liveRowLanguage(["FR", "EN"]), "FR", "FR");
  assert.equal(liveRowLanguage(["Français"]), "FR", "label → code");
  assert.equal(liveRowLanguage([]), null, "empty");
  assert.equal(liveRowLanguage(null), null, "null");
  assert.false(liveRowLanguage(["FR"]) === "Français", "not Français");
});

test("liveRowLevel — CASUAL CHILL, COMPETITIVE COMP", () => {
  assert.equal(liveRowLevel("CASUAL"), "CHILL", "chill");
  assert.equal(liveRowLevel("COMPETITIVE"), "COMP", "comp");
  assert.equal(LIVE_ROW_LEVEL.CASUAL, "CHILL", "map casual");
  assert.equal(LIVE_ROW_LEVEL.COMPETITIVE, "COMP", "map comp");
  assert.equal(liveRowLevel("ELITE"), null, "unknown");
});

test("resolveClubForm — réel gagne ; DEV 5 lettres ; prod vide null", () => {
  assert.equal(resolveClubForm({ form: "vndvv", isDev: true, clubId: "c1" }), "VNDVV", "real wins");
  assert.equal(parseClubForm("1V · 1N · 0D"), null, "not W-D-L line");
  const a = resolveClubForm({ form: null, isDev: true, clubId: "club-a" });
  const b = resolveClubForm({ form: null, isDev: true, clubId: "club-a" });
  const c = resolveClubForm({ form: null, isDev: true, clubId: "club-b" });
  assert.equal(a, b, "dev stable");
  assert.equal(a?.length, 5, "5 letters");
  assert.true(/^[VND]{5}$/.test(a ?? ""), "VND only");
  assert.false(a === c, "varies by clubId");
  assert.equal(resolveClubForm({ form: null, isDev: false, clubId: "c1" }), null, "prod empty");
  assert.false((a ?? "").includes("EA"), "never EA");
});

test("resolveMemberCount — réel gagne ; DEV 5–11 ; prod vide null", () => {
  assert.equal(resolveMemberCount({ memberCount: 8, isDev: true, clubId: "c1" }), 8, "real");
  assert.equal(resolveMemberCount({ memberCount: 0, isDev: true, clubId: "c1" }), 0, "zero real");
  const n = resolveMemberCount({ memberCount: null, isDev: true, clubId: "c1" });
  assert.true(typeof n === "number" && n >= 5 && n <= 11, "dev 5-11");
  assert.equal(resolveMemberCount({ memberCount: null, isDev: false, clubId: "c1" }), null, "prod empty");
});

test("formatLiveRowMeta — FR · CHILL · 8 · VNDVV", () => {
  assert.equal(
    formatLiveRowMeta({ language: "FR", level: "CHILL", memberCount: 8, form: "VNDVV" }),
    "FR · CHILL · 8 · VNDVV",
    "full"
  );
  assert.equal(formatLiveRowMeta({ language: "FR", level: "CHILL" }), "FR · CHILL", "partial");
  const meta = buildClubLiveRowMeta({
    languages: ["FR"],
    level: "CASUAL",
    memberCount: 8,
    form: "VNDVV",
    clubId: "c1",
    isDev: false,
  });
  assert.equal(meta, "FR · CHILL · 8 · VNDVV", "builder");
});

test("source — jamais EA, jamais ClubCard sur la ligne", () => {
  const row = readFileSync(`${process.cwd()}/lib/clubLiveRow.ts`, "utf8");
  const card = readFileSync(`${process.cwd()}/components/live/LiveClubCard.tsx`, "utf8");
  const filters = readFileSync(`${process.cwd()}/components/live/MatchmakingFilters.tsx`, "utf8");
  assert.true(row.includes("Jamais des stats EA") || row.includes("Jamais EA"), "never EA comment");
  assert.false(row.includes("verified_stats"), "no verified_stats");
  assert.true(card.includes("Voir") || card.includes("voir"), "preview cta");
  assert.true(card.includes("Rejoindre") || card.includes("rejoindre"), "join cta");
  assert.true(card.includes("clubPublicHref"), "href club page");
  assert.false(card.includes("@/components/club/ClubCard"), "no ClubCard import");
  assert.false(/<ClubCard[\s>]/.test(card), "no ClubCard element");
  assert.false(card.includes("LiveCountdown"), "no countdown");
  assert.true(card.includes("Aperçu"), "preview a11y");
  assert.true(card.includes("formatNeededPositionsLine"), "needed positions on row");
  assert.true(filters.includes("Poste"), "poste");
  assert.true(filters.includes("Langue"), "langue");
  assert.true(filters.includes("Rythme"), "rythme");
  assert.false(filters.includes("Plateforme"), "no platform");
  assert.false(filters.includes("Sheet"), "no extra filtres sheet");
});

console.log(`\n${passed} test(s) passés.`);

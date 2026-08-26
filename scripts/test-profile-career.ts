/**
 * Tests de lib/profileCareer.ts — tuiles réelles vs overlay DEV.
 * Lancer : npx tsx scripts/test-profile-career.ts
 */
import {
  CAREER_DEV_CAPTION,
  CAREER_TILE_KEYS,
  CAREER_TILE_LABELS,
  buildDevCareerTiles,
  careerTilesCaption,
  readStoredCareerTiles,
  resolveCareerTiles,
} from "../lib/profileCareer";
import { statsSourceLabel } from "../lib/statsSource";
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

function read(rel: string): string {
  return readFileSync(`${process.cwd()}/${rel}`, "utf8");
}

const FORBIDDEN = [
  "ClubsZone",
  "Free Agent",
  "Discord",
  "Unclaim",
  "Refresh Stats",
  "MOTM",
  "Pass %",
  "Tackle %",
  "skill-moves",
  "weak-foot",
  "weak foot",
  "£",
];

console.log("lib/profileCareer.ts");

test("CAREER_TILE_KEYS — Matchs/Buts/Passes/Note", () => {
  assert.equal(CAREER_TILE_KEYS.join(","), "matches,goals,assists,rating", "keys");
  assert.equal(CAREER_TILE_LABELS.matches, "Matchs", "matchs");
  assert.equal(CAREER_TILE_LABELS.goals, "Buts", "buts");
  assert.equal(CAREER_TILE_LABELS.assists, "Passes", "passes");
  assert.equal(CAREER_TILE_LABELS.rating, "Note", "note");
});

test("prod vide → aucune tuile (pas de —)", () => {
  const tiles = resolveCareerTiles({
    verified: null,
    identityKind: "NONE",
    cpcMatchesPlayed: 0,
    isDev: false,
    seed: "u1",
  });
  assert.equal(tiles.length, 0, "empty");
  assert.equal(careerTilesCaption(tiles), null, "no caption");
});

test("USERNAME_EQUALITY + buts réels → tuile Buts, pas DEV", () => {
  const tiles = resolveCareerTiles({
    verified: { goals: 12, pac: 88 },
    identityKind: "USERNAME_EQUALITY",
    cpcMatchesPlayed: null,
    isDev: true,
    seed: "u1",
  });
  assert.equal(tiles.length, 1, "only stored career");
  assert.equal(tiles[0]?.key, "goals", "goals");
  assert.equal(tiles[0]?.label, "Buts", "label");
  assert.equal(tiles[0]?.value, "12", "value");
  assert.equal(tiles[0]?.source, "EA", "ea");
  assert.false(tiles.some((t) => t.source === "DEV"), "no mix DEV");
  assert.equal(careerTilesCaption(tiles), statsSourceLabel("EA"), "caption EA");
});

test("CPC matchs seulement → tuile Matchs CPC", () => {
  const tiles = resolveCareerTiles({
    verified: { goals: 9 },
    identityKind: "NONE",
    cpcMatchesPlayed: 7,
    isDev: true,
    seed: "u1",
  });
  assert.equal(tiles.length, 1, "cpc only");
  assert.equal(tiles[0]?.key, "matches", "matches");
  assert.equal(tiles[0]?.label, "Matchs", "label");
  assert.equal(tiles[0]?.value, "7", "value");
  assert.equal(tiles[0]?.source, "CPC", "cpc");
  assert.false(tiles.some((t) => t.source === "DEV"), "no DEV when real");
  assert.equal(careerTilesCaption(tiles), statsSourceLabel("CPC"), "caption CPC");
});

test("DEV 4-pack seulement si rien de réel", () => {
  const tiles = resolveCareerTiles({
    verified: null,
    identityKind: "NONE",
    cpcMatchesPlayed: 0,
    isDev: true,
    seed: "selim-u1",
  });
  assert.equal(tiles.length, 4, "4-pack");
  assert.equal(tiles.map((t) => t.key).join(","), "matches,goals,assists,rating", "order");
  assert.true(tiles.every((t) => t.source === "DEV"), "all DEV");
  assert.true(tiles.every((t) => t.label !== "Buts EA" && t.label !== "Note EA"), "not EA labels");
  assert.equal(tiles.find((t) => t.key === "rating")?.highlight, true, "note highlighted");
  assert.equal(careerTilesCaption(tiles), CAREER_DEV_CAPTION, "dev caption");
  assert.false(careerTilesCaption(tiles) === statsSourceLabel("EA"), "never EA caption");
});

test("pack réel + isDev → pas de DEV", () => {
  const tiles = resolveCareerTiles({
    verified: { goals: 4, assists: 2, matchesPlayed: 11, avgRating: 7.4 },
    identityKind: "USERNAME_EQUALITY",
    cpcMatchesPlayed: 3,
    isDev: true,
    seed: "u1",
  });
  assert.equal(tiles.length, 4, "stored four");
  assert.true(tiles.every((t) => t.source === "EA"), "all EA");
  assert.equal(tiles.find((t) => t.key === "matches")?.value, "11", "ea matches wins over cpc");
  assert.equal(tiles.find((t) => t.key === "rating")?.value, "7.4", "note");
  assert.equal(tiles.find((t) => t.key === "rating")?.highlight, true, "note green");
});

test("EA buts + CPC matchs (pas de matchs EA) → mix, Matchs en premier", () => {
  const tiles = resolveCareerTiles({
    verified: { goals: 5 },
    identityKind: "USERNAME_EQUALITY",
    cpcMatchesPlayed: 9,
    isDev: true,
    seed: "u1",
  });
  assert.equal(tiles.map((t) => t.key).join(","), "matches,goals", "order");
  assert.equal(tiles[0]?.source, "CPC", "cpc matches");
  assert.equal(tiles[1]?.source, "EA", "ea goals");
  assert.equal(careerTilesCaption(tiles), null, "mixed no fake EA-only caption");
});

test("readStoredCareerTiles ignore face + pack incomplet", () => {
  assert.equal(readStoredCareerTiles(null).length, 0, "null");
  assert.equal(readStoredCareerTiles({ pac: 90, sho: 80 }).length, 0, "face only");
  const partial = readStoredCareerTiles({ goals: 3, avgRating: 0, assists: -1 });
  assert.equal(partial.length, 1, "only goals");
  assert.equal(partial[0]?.key, "goals", "goals");
});

test("buildDevCareerTiles déterministe, jamais EA", () => {
  const a = buildDevCareerTiles("seed-a");
  const b = buildDevCareerTiles("seed-a");
  const c = buildDevCareerTiles("seed-b");
  assert.equal(JSON.stringify(a), JSON.stringify(b), "stable");
  assert.false(JSON.stringify(a) === JSON.stringify(c), "varies by seed");
  assert.true(a.every((t) => t.source === "DEV"), "dev source");
  assert.equal(careerTilesCaption(a), CAREER_DEV_CAPTION, "caption");
});

test("club lié sans USERNAME_EQUALITY → pas de tuiles EA", () => {
  const tiles = resolveCareerTiles({
    verified: { goals: 40, assists: 12, matchesPlayed: 20, avgRating: 8.1 },
    identityKind: "NONE",
    cpcMatchesPlayed: null,
    isDev: false,
    seed: "u1",
  });
  assert.equal(tiles.length, 0, "no fake EA");
});

console.log("wiring ProfileOverview / ProfileContent");

test("ProfileContent passe par ProfileOverview ; actions + avis + LinkEaClub", () => {
  const content = read("components/profile/ProfileContent.tsx");
  const overview = read("components/profile/ProfileOverview.tsx");
  const tab = read("app/(player)/(tabs)/profile.tsx");
  const home = read("components/home/HomeScreen.tsx");
  const career = read("lib/profileCareer.ts");

  assert.true(content.includes("ProfileOverview"), "wired");
  assert.true(content.includes("actionsSlot"), "actionsSlot");
  assert.true(content.includes("reviewsSlot"), "reviewsSlot");
  assert.true(content.includes("onLinkEaClub"), "EA CTA wired");
  assert.true(content.includes("LinkEaClubForm"), "link sheet");
  assert.true(content.includes("ScoutReportPanel"), "scout");
  assert.true(content.includes("ReviewForm"), "review form");
  assert.true(content.includes("StartDirectMessageButton"), "dm");
  assert.true(content.includes("Retirer de la feuille"), "remove from sheet");
  assert.true(content.includes("useClearSlotAssignment"), "mutates slots");
  assert.true(content.includes("Bloquer"), "block stays");

  assert.true(overview.includes("Aperçu"), "tab aperçu");
  assert.true(overview.includes("Historique"), "tab historique");
  assert.true(overview.includes("Avis"), "tab avis");
  assert.true(overview.includes("ClubProCard"), "full card");
  assert.true(overview.includes("MatchHistoryList"), "history tab");
  assert.true(overview.includes("POSITIONS"), "position grid");
  assert.true(overview.includes("OVR_CPC_LABEL"), "ovr cpc");
  assert.true(overview.includes("PLAYER_CARD_COPY.sansClub"), "sans club");
  assert.true(overview.includes('"/edit-profile"') || overview.includes("'/edit-profile'"), "modifier");
  assert.true(overview.includes("nextPositionsOnTap"), "inline positions");
  assert.true(overview.includes("useUpdateOwnProfile"), "own profile mutate");
  assert.true(overview.includes("onLongPress"), "long-press secondary");
  assert.true(overview.includes('toast.info("3 postes max.")'), "max 3 toast");
  assert.true(overview.includes(">Poste<"), "Poste label + chips");
  assert.true(overview.includes("`/club/${resolvedClubId}`") || overview.includes("/club/"), "voir le club");
  assert.false(overview.includes("matchHistory="), "card has no history footer");
  assert.false(overview.includes("vars("), "no vars() wrapping");

  assert.true(tab.includes("DevTestAccountSwitcher"), "switcher stays on tab");
  assert.true(home.includes("ClubProCard"), "accueil card");
  assert.true(home.includes("onPress={goProfile}"), "accueil tap → profil");
  assert.false(home.includes("matchHistory="), "accueil card unchanged — no history footer");
  assert.false(home.includes("ProfileOverview"), "accueil not overview");

  assert.true(career.includes("Never persist") || career.includes("jamais écrit") || career.includes("Jamais persisté"), "never persist");

  for (const file of [overview, content, career]) {
    for (const bad of FORBIDDEN) {
      assert.false(file.includes(bad), `forbidden « ${bad} »`);
    }
  }
});

console.log(`\n${passed} test(s) passés.`);

/**
 * Claim EA — gate Confirmer + normalize ne mappe jamais regionId.
 * Lancer : npx tsx scripts/test-link-ea-club-form.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import { canCallLinkEaClub, formatVisibleMembers, isNumericEaClubId, parseNumericEaClubId } from "../lib/eaClubClaim";
import { normalizeSearchResults } from "../supabase/functions/_shared/ea/normalize";

const assert = {
  deepEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée (${label}).\n  reçu: ${a}\n  attendu: ${b}`);
  },
  ok(value: unknown, label: string) {
    if (!value) throw new Error(`Assertion échouée (${label}) : valeur falsy.`);
  },
  true(value: unknown, label: string) {
    if (value !== true) throw new Error(`Assertion échouée (${label})`);
  },
  false(value: unknown, label: string) {
    if (value !== false) throw new Error(`Assertion échouée (${label})`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

function read(path: string) {
  return readFileSync(`${process.cwd()}/${path}`, "utf8");
}

console.log("EA claim — LinkEaClubForm confirm gate");

test("parseNumericEaClubId refuse vide / texte / UUID", () => {
  assert.deepEqual(parseNumericEaClubId("42450"), "42450", "EA");
  assert.deepEqual(parseNumericEaClubId(66), "66", "digits");
  assert.false(isNumericEaClubId(""), "vide");
  assert.false(isNumericEaClubId("cpc_lm"), "username");
  assert.false(isNumericEaClubId("not-an-id"), "texte");
});

test("canCallLinkEaClub seulement en phase confirm", () => {
  assert.false(canCallLinkEaClub("search"), "search");
  assert.false(canCallLinkEaClub("candidates"), "liste");
  assert.true(canCallLinkEaClub("confirm"), "confirm");
});

test("formatVisibleMembers top 3", () => {
  assert.deepEqual(formatVisibleMembers([]), null, "vide");
  assert.deepEqual(formatVisibleMembers(["Ramsen7", "A", "B", "C"]), "membres visibles: Ramsen7, A, B", "top3");
});

test("normalize search — incident Possibly FC regionId 49552 ≠ clubId 42450", () => {
  const clubs = normalizeSearchResults(
    [{ clubId: "42450", name: "Possibly FC", regionId: 49552, teamId: 111651 }],
    "proclubs-community",
    "common-gen5"
  );
  assert.deepEqual(clubs.map((c) => c.externalId), ["42450"], "clubId");
  assert.true(!JSON.stringify(clubs).includes("49552"), "regionId absent du normalisé utile");
});

test("LinkEaClubForm — tap candidat ≠ link ; Confirmer / Annuler / ID EA", () => {
  const src = read("components/profile/LinkEaClubForm.tsx");
  assert.true(src.includes("selectCandidate"), "select");
  assert.true(src.includes("canCallLinkEaClub"), "gate");
  assert.true(src.includes("LINK_EA_CLUB_COPY.confirm"), "Confirmer");
  assert.true(src.includes("LINK_EA_CLUB_COPY.cancel"), "Annuler");
  assert.true(src.includes("ID EA"), "label ID EA");
  assert.true(src.includes("identique"), "USERNAME_EQUALITY copy");
  assert.true(src.includes("pendingConfirm"), "confirm state");
  assert.true(src.includes("onPress={() => selectCandidate(c)}"), "row = select, pas link");
  assert.true(src.includes("onPress={runLink}"), "link seulement confirm");
  assert.false(src.includes("regionId"), "jamais regionId à l'écran");
  assert.true(src.includes("font-mono"), "clubId mono");
  assert.true(src.includes("action: \"unlink\"") || src.includes("useUnlinkEaClub"), "unlink");
});

test("ProfileContent — relier même si déjà lié", () => {
  const content = read("components/profile/ProfileContent.tsx");
  assert.true(content.includes("linkedClubId={user.ea_club_linked}"), "linked id");
  assert.true(content.includes("isOwn ? () => setEaSheetOpen(true)"), "CTA own always");
  assert.false(content.includes("isOwn && !user.ea_club_linked"), "plus bloqué si lié");
});

test("manager — Lier le club EA écrit clubs.ea_club_id via confirm", () => {
  const form = read("components/profile/LinkEaClubForm.tsx");
  const create = read("app/create-club.tsx");
  const clubTab = read("app/(club)/(tabs)/effectif.tsx");
  const edge = read("supabase/functions/link-ea-club/index.ts");
  assert.true(form.includes('target?: "player" | "managed-club"'), "target");
  assert.true(form.includes("LINK_EA_CLUB_COPY.clubTitle"), "club title");
  assert.true(form.includes("useLinkManagedEaClub"), "managed link");
  assert.true(create.includes('target="managed-club"'), "create-club offer");
  assert.true(create.includes("Le LIVE marche déjà sans") || create.includes("LIVE marche"), "LIVE without EA");
  assert.true(clubTab.includes('target="managed-club"'), "mon club");
  assert.true(edge.includes("link-club"), "edge action");
  assert.true(edge.includes("ea_club_id"), "column");
  assert.false(form.includes("regionId"), "jamais regionId");
});

console.log(`\n${passed} test(s) passés.`);

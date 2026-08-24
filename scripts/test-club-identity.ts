/**
 * Tests de lib/clubIdentity.ts — allowlist des colonnes éditables par le
 * OWNER (identité club Pro Clubs) et validation type create-club. Sans réseau.
 *
 * Lancer : npx tsx scripts/test-club-identity.ts
 */
import {
  canEditClubIdentity,
  CLUB_CLIENT_FORBIDDEN_COLUMNS,
  CLUB_OWNER_UPDATE_COLUMNS,
  isAllowedClubIdentityColumn,
  pickAllowedClubIdentityPatch,
  validateClubIdentity,
} from "../lib/clubIdentity";

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

console.log("lib/clubIdentity.ts");

const validInput = {
  name: "  Les Invincibles  ",
  level: "CASUAL",
  languages: ["FR", "EN"],
  description: "  Ambiance chill  ",
  voice_link: "  https://discord.gg/club  ",
};

test("colonnes autorisées = identité create-club + vocal déjà persisté", () => {
  assert.deepEqual(
    [...CLUB_OWNER_UPDATE_COLUMNS],
    ["name", "level", "languages", "description", "voice_link"],
    "allowlist"
  );
  for (const col of CLUB_OWNER_UPDATE_COLUMNS) {
    assert.true(isAllowedClubIdentityColumn(col), col);
  }
});

test("colonnes interdites (owner_id, formation, ea, plateforme inventée) hors allowlist", () => {
  for (const col of CLUB_CLIENT_FORBIDDEN_COLUMNS) {
    assert.false(isAllowedClubIdentityColumn(col), col);
  }
  assert.false(isAllowedClubIdentityColumn("platform"), "clubs.platform n'existe pas");
  assert.false(isAllowedClubIdentityColumn("owner_id"), "owner_id");
  assert.false(isAllowedClubIdentityColumn("formation"), "formation = autre mutation");
});

test("pickAllowedClubIdentityPatch ne garde que l'allowlist", () => {
  const picked = pickAllowedClubIdentityPatch({
    ...validInput,
    owner_id: "should-not-send",
    platform: "PS",
    ea_club_id: "ea-123",
    formation: "4-3-3",
    id: "club-id",
    created_at: "2026-01-01T00:00:00.000Z",
  });
  assert.deepEqual(Object.keys(picked).sort(), [...CLUB_OWNER_UPDATE_COLUMNS].sort(), "keys");
  assert.equal("owner_id" in picked, false, "no owner_id");
  assert.equal("platform" in picked, false, "no platform");
  assert.equal("ea_club_id" in picked, false, "no ea_club_id");
  assert.equal("formation" in picked, false, "no formation");
  assert.equal("id" in picked, false, "no id");
  assert.equal(picked.name, "  Les Invincibles  ", "name raw (trim = validate)");
});

test("pickAllowed — payload uniquement interdit → objet vide (rien à envoyer)", () => {
  const picked = pickAllowedClubIdentityPatch({
    owner_id: "u1",
    platform: "PC",
    formation: "4-3-3",
    ea_club_id: "x",
  });
  assert.deepEqual(picked, {}, "empty");
});

test("validate — payload create-club + vocal (trim, vides → null)", () => {
  const result = validateClubIdentity({
    ...validInput,
    owner_id: "u-owner",
    platform: "XBOX",
    formation: "4-4-2",
  });
  assert.true(result.ok, "ok");
  if (!result.ok) return;
  assert.equal(result.patch.name, "Les Invincibles", "trim name");
  assert.equal(result.patch.level, "CASUAL", "level");
  assert.deepEqual(result.patch.languages, ["FR", "EN"], "languages");
  assert.equal(result.patch.description, "Ambiance chill", "trim description");
  assert.equal(result.patch.voice_link, "https://discord.gg/club", "trim voice");
  assert.equal("owner_id" in result.patch, false, "owner_id absent du patch");
  assert.equal("platform" in result.patch, false, "platform absente du patch");
  assert.equal("formation" in result.patch, false, "formation absente du patch");
});

test("validate — nom / langues comme create-club ; niveau enum ; optionnels vides → null", () => {
  assert.false(validateClubIdentity({ ...validInput, name: "   " }).ok, "name vide");
  assert.false(validateClubIdentity({ ...validInput, languages: [] }).ok, "languages vide");
  assert.false(validateClubIdentity({ ...validInput, languages: ["XX"] }).ok, "langue inconnue");
  assert.false(validateClubIdentity({ ...validInput, level: "PRO" }).ok, "niveau inventé");
  const cleared = validateClubIdentity({ ...validInput, description: "  ", voice_link: "" });
  assert.true(cleared.ok, "optionnels vides ok");
  if (cleared.ok) {
    assert.equal(cleared.patch.description, null, "description null");
    assert.equal(cleared.patch.voice_link, null, "voice_link null");
  }
});

test("canEditClubIdentity — OWNER seulement (RLS clubs_update_owner), pas MANAGER", () => {
  assert.true(canEditClubIdentity("owner-1", "owner-1"), "owner");
  assert.false(canEditClubIdentity("owner-1", "manager-1"), "manager");
  assert.false(canEditClubIdentity("owner-1", null), "pas de session");
  assert.false(canEditClubIdentity(null, "owner-1"), "pas d'owner");
});

console.log(`\n${passed} tests OK`);

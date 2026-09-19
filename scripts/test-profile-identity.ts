/**
 * Tests de lib/profileIdentity.ts — allowlist des colonnes auto-éditables
 * (identité Pro Clubs) et validation type onboarding. Sans réseau.
 *
 * Lancer : npx tsx scripts/test-profile-identity.ts
 */
import {
  isAllowedProfileIdentityColumn,
  nextPositionsOnTap,
  pickAllowedProfileIdentityPatch,
  PROFILE_CLIENT_FORBIDDEN_COLUMNS,
  PROFILE_SELF_UPDATE_COLUMNS,
  validateProfileIdentity,
} from "../lib/profileIdentity";
import type { PositionCode } from "../lib/constants";
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

console.log("lib/profileIdentity.ts");

const validInput = {
  username: "  Striker27  ",
  platform: "PS",
  main_position: "ST",
  secondary_positions: ["CAM", "RW"],
  play_style: "ATTACKING",
  languages: ["FR", "EN"],
  availability: { slots: ["weekend", "weekday_evening"] },
};

test("colonnes autorisées = identité ClubPro Card + langues/dispo onboarding", () => {
  assert.deepEqual(
    [...PROFILE_SELF_UPDATE_COLUMNS],
    ["username", "platform", "main_position", "secondary_positions", "play_style", "languages", "availability"],
    "allowlist"
  );
  for (const col of PROFILE_SELF_UPDATE_COLUMNS) {
    assert.true(isAllowedProfileIdentityColumn(col), col);
  }
});

test("colonnes interdites (score, stats EA, plan, identité EA, …) hors allowlist", () => {
  for (const col of PROFILE_CLIENT_FORBIDDEN_COLUMNS) {
    assert.false(isAllowedProfileIdentityColumn(col), col);
  }
  assert.false(isAllowedProfileIdentityColumn("player_level"), "player_level inventé");
  assert.false(isAllowedProfileIdentityColumn("ovr"), "ovr inventé");
});

test("pickAllowedProfileIdentityPatch ne garde que l'allowlist", () => {
  const picked = pickAllowedProfileIdentityPatch({
    ...validInput,
    reliability_score: 99,
    verified_stats: { goals: 12 },
    ea_identity_kind: "USERNAME_EQUALITY",
    plan: "PRO",
    player_level: "COMPETITIVE",
    ovr: 91,
    id: "should-not-send",
    push_token: "ExponentPushToken[xxx]",
  });
  assert.deepEqual(
    Object.keys(picked).sort(),
    [...PROFILE_SELF_UPDATE_COLUMNS].sort(),
    "keys"
  );
  assert.equal("reliability_score" in picked, false, "no reliability_score");
  assert.equal("verified_stats" in picked, false, "no verified_stats");
  assert.equal("ea_identity_kind" in picked, false, "no ea_identity_kind");
  assert.equal("plan" in picked, false, "no plan");
  assert.equal("player_level" in picked, false, "no player_level");
  assert.equal("ovr" in picked, false, "no ovr");
  assert.equal("id" in picked, false, "no id");
  assert.equal(picked.username, "  Striker27  ", "username raw (trim = validate)");
});

test("pickAllowed — payload uniquement interdit → objet vide (rien à envoyer)", () => {
  const picked = pickAllowedProfileIdentityPatch({
    reliability_score: 1,
    plan: "PRO",
    ea_identity_kind: "NONE",
    verified_stats: { goals: 1 },
  });
  assert.deepEqual(picked, {}, "empty");
});

test("validate — payload onboarding valide (trim username, slots filtrés)", () => {
  const result = validateProfileIdentity({
    ...validInput,
    reliability_score: 80,
    plan: "PRO",
  });
  assert.true(result.ok, "ok");
  if (!result.ok) return;
  assert.equal(result.patch.username, "Striker27", "trim");
  assert.equal(result.patch.platform, "PS", "platform");
  assert.equal(result.patch.main_position, "ST", "main");
  assert.deepEqual(result.patch.secondary_positions, ["CAM", "RW"], "secondary");
  assert.equal(result.patch.play_style, "ATTACKING", "style");
  assert.deepEqual(result.patch.languages, ["FR", "EN"], "languages");
  assert.deepEqual(result.patch.availability, { slots: ["weekend", "weekday_evening"] }, "slots");
  assert.equal("plan" in result.patch, false, "plan absent du patch");
  assert.equal("reliability_score" in result.patch, false, "score absent du patch");
});

test("validate — username trop court, plateforme / poste / style manquants", () => {
  assert.false(validateProfileIdentity({ ...validInput, username: "ab" }).ok, "username");
  assert.false(validateProfileIdentity({ ...validInput, platform: "SWITCH" }).ok, "platform");
  assert.false(validateProfileIdentity({ ...validInput, main_position: "" }).ok, "main");
  assert.false(validateProfileIdentity({ ...validInput, play_style: "" }).ok, "style");
  assert.false(validateProfileIdentity({ ...validInput, languages: [] }).ok, "languages");
});

test("validate — max 2 secondaires, principal exclu, langues requises", () => {
  assert.false(
    validateProfileIdentity({ ...validInput, secondary_positions: ["CAM", "RW", "LW"] }).ok,
    "too many secondary"
  );
  const droppedMain = validateProfileIdentity({
    ...validInput,
    secondary_positions: ["ST", "CAM"],
  });
  assert.true(droppedMain.ok, "main stripped from secondary");
  if (droppedMain.ok) {
    assert.deepEqual(droppedMain.patch.secondary_positions, ["CAM"], "secondary without main");
  }
});

function sel(main: PositionCode, secondary: PositionCode[] = []) {
  return { main_position: main, secondary_positions: secondary };
}

function okSel(main: PositionCode, secondary: PositionCode[] = []) {
  return { ok: true as const, ...sel(main, secondary) };
}

test("nextPositionsOnTap — vide → secondaire (max 2)", () => {
  assert.deepEqual(nextPositionsOnTap(sel("ST"), "CAM"), okSel("ST", ["CAM"]), "first secondary");
  assert.deepEqual(nextPositionsOnTap(sel("ST", ["CAM"]), "RW"), okSel("ST", ["CAM", "RW"]), "second");
});

test("nextPositionsOnTap — 2e tap sur un sélectionné le retire (pas un promote)", () => {
  assert.deepEqual(nextPositionsOnTap(sel("ST", ["CAM"]), "CAM"), okSel("ST"), "remove secondary");
  assert.deepEqual(
    nextPositionsOnTap(sel("ST", ["CAM", "RW"]), "CAM"),
    okSel("ST", ["RW"]),
    "remove one of two"
  );
});

test("nextPositionsOnTap — tap principal le retire ; 1er secondaire devient principal", () => {
  assert.deepEqual(nextPositionsOnTap(sel("ST", ["CAM", "RW"]), "ST"), okSel("CAM", ["RW"]), "promote leftover");
  assert.deepEqual(nextPositionsOnTap(sel("ST"), "ST"), { ok: false, reason: "noop" }, "keep last");
});

test("nextPositionsOnTap — 4e case vide refusée (reason max), jamais ajoutée", () => {
  assert.deepEqual(
    nextPositionsOnTap(sel("ST", ["CAM", "RW"]), "LW"),
    { ok: false, reason: "max" },
    "refused"
  );
  assert.deepEqual(
    nextPositionsOnTap(sel("ST", ["CAM", "RW"]), "CAM"),
    okSel("ST", ["RW"]),
    "toggle off at cap is not max"
  );
});

test("nextPositionsOnTap — long-press retire comme le tap", () => {
  assert.deepEqual(
    nextPositionsOnTap(sel("ST", ["CAM", "RW"]), "CAM", "long-press"),
    okSel("ST", ["RW"]),
    "remove secondary"
  );
  assert.deepEqual(
    nextPositionsOnTap(sel("ST", ["CAM"]), "ST", "long-press"),
    okSel("CAM"),
    "remove main promotes leftover"
  );
  assert.deepEqual(
    nextPositionsOnTap(sel("ST", ["CAM"]), "RW", "long-press"),
    { ok: false, reason: "noop" },
    "empty no-op"
  );
});

test("nextPositionsOnTap + validateProfileIdentity — patch identité complète, pas de stats EA", () => {
  const next = nextPositionsOnTap(sel("ST", ["CAM"]), "RW");
  assert.true(next.ok, "next");
  if (!next.ok) return;
  const result = validateProfileIdentity({
    username: "Striker27",
    platform: "PS",
    main_position: next.main_position,
    secondary_positions: next.secondary_positions,
    play_style: "ATTACKING",
    languages: ["FR"],
    availability: { slots: ["weekend"] },
    reliability_score: 99,
    verified_stats: { goals: 40 },
    ea_identity_kind: "USERNAME_EQUALITY",
  });
  assert.true(result.ok, "ok");
  if (!result.ok) return;
  assert.equal(result.patch.main_position, "ST", "main unchanged");
  assert.deepEqual(result.patch.secondary_positions, ["CAM", "RW"], "added RW");
  assert.equal("verified_stats" in result.patch, false, "no EA stats");
  assert.equal("reliability_score" in result.patch, false, "no score");
});

test("grille profil perso : inline, pas de navigation / popup", () => {
  const overview = readFileSync(`${process.cwd()}/components/profile/ProfileOverview.tsx`, "utf8");
  assert.true(overview.includes("nextPositionsOnTap"), "tap helper");
  assert.true(overview.includes("useUpdateOwnProfile"), "mutation");
  assert.true(overview.includes("validateProfileIdentity"), "full identity validate");
  assert.true(overview.includes("onLongPress"), "long-press still wired");
  assert.true(overview.includes('toast.info("3 postes max.")'), "max toast");
  assert.true(overview.includes("Retirer le poste"), "selected tap removes");
  assert.true(overview.includes("Ajouter"), "empty tap adds");
  assert.true(overview.includes("`main-${main}`"), "main chip key");
  assert.true(overview.includes("`sec-${pos}`"), "sec chip key");
  assert.true(overview.includes("`grid-${pos}`"), "grid key");
  assert.true(overview.includes("[...new Set("), "dedupe secondary");
  const card = readFileSync(`${process.cwd()}/components/player/PlayerCard.tsx`, "utf8");
  assert.true(card.includes("`sec-${code}`"), "card sec key");
  const builder = readFileSync(`${process.cwd()}/lib/playerCard.ts`, "utf8");
  assert.true(builder.includes("new Set((user.secondary_positions ?? []).filter((p) => p !== user.main_position))"), "builder dedupe");
  assert.true(overview.includes('router.push("/edit-profile")'), "Modifier header stays");
  assert.false(overview.includes("Alert.alert"), "no popup");
  assert.false(overview.includes("Poste ${code}, modifier le profil"), "grid does not open edit-profile");
});

console.log(`\n${passed} tests OK`);

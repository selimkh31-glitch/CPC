/**
 * Club disparu / id stale — empty + créer, pas l'erreur réseau.
 * Lancer : npx tsx scripts/test-club-gone.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import { clubReadOrNull, isGoneClubReadError } from "../lib/clubRead";

const root = process.cwd();

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

function read(rel: string) {
  return readFileSync(`${root}/${rel}`, "utf8");
}

console.log("Club disparu / id stale");

test("PGRST116 et 0 rows = club gone, pas une erreur à throw", () => {
  assert.true(isGoneClubReadError({ code: "PGRST116" }), "code");
  assert.true(isGoneClubReadError({ message: "JSON object requested, multiple (or no) rows returned" }), "0 rows msg");
  assert.true(isGoneClubReadError({ details: "PGRST116" }), "details");
  assert.false(isGoneClubReadError({ code: "42501", message: "permission denied" }), "rls");
  assert.false(isGoneClubReadError({ message: "Failed to fetch" }), "network");
  assert.false(isGoneClubReadError(null), "null");
  assert.equal(clubReadOrNull({ data: null, error: { code: "PGRST116" } }), null, "orNull gone");
  const row = clubReadOrNull({ data: { id: "c1" }, error: null });
  assert.equal(row && typeof row === "object" && "id" in row ? row.id : null, "c1", "orNull ok");
  let threw = false;
  try {
    clubReadOrNull({ data: null, error: { code: "42501", message: "permission denied" } });
  } catch {
    threw = true;
  }
  assert.true(threw, "rls still throws");
});

test("useClub : maybeSingle + club gone = null", () => {
  const src = read("lib/hooks/useClubs.ts");
  assert.true(src.includes("clubReadOrNull"), "helper");
  assert.true(src.includes("maybeSingle"), "maybeSingle");
  assert.false(/\.eq\("id", clubId!\)\s*\.single\(\)/.test(src), "no single on club read");
});

test("layout vide l'id stale, ne persiste pas selectedManagedClubId", () => {
  const layout = read("app/(club)/_layout.tsx");
  const provider = read("lib/providers/AppModeProvider.tsx");
  assert.true(layout.includes("managedClubs.length === 0"), "zero branch");
  assert.true(layout.includes("setSelectedManagedClubId(null)"), "clear stale");
  assert.true(layout.includes("return <Slot />"), "tabs still mount");
  assert.true(provider.includes("SecureStore.setItemAsync(appModeStorageKey"), "only mode key");
  assert.false(provider.includes("cpc.managedClub"), "no club id storage key");
});

test("LIVE / Recrutement / Club : missing club = empty + Créer un club, pas l'erreur", () => {
  const screens = [
    "app/(club)/(tabs)/index.tsx",
    "app/(club)/(tabs)/candidatures.tsx",
    "app/(club)/(tabs)/effectif.tsx",
  ];
  for (const rel of screens) {
    const src = read(rel);
    const emptyIdx = src.indexOf('title="Aucun club géré"');
    const createIdx = src.indexOf('router.push("/create-club")');
    const errorIdx = src.indexOf('message="Impossible de charger ce club."');
    assert.true(emptyIdx >= 0, `${rel} empty`);
    assert.true(createIdx >= 0, `${rel} create`);
    assert.true(errorIdx >= 0, `${rel} real error still exists`);
    const emptyBlock = src.slice(emptyIdx, emptyIdx + 500);
    assert.true(emptyBlock.includes("Créer un club") || src.slice(Math.max(0, createIdx - 200), createIdx + 80).includes("create-club"), `${rel} create near empty`);
    assert.false(emptyBlock.includes("Impossible de charger ce club."), `${rel} empty is not error copy`);
  }
  const rec = read("app/(club)/(tabs)/candidatures.tsx");
  const recEmpty = rec.slice(rec.indexOf("if (!club)"), rec.indexOf("if (!club)") + 450);
  assert.true(recEmpty.includes("Créer un club"), "recrutement create button");
  assert.false(recEmpty.includes("Impossible de charger ce club."), "recrutement empty not error");
});

test("onglet Club : switcher même en erreur réseau", () => {
  const clubTab = read("app/(club)/(tabs)/effectif.tsx");
  const errorIdx = clubTab.indexOf('message="Impossible de charger ce club."');
  const afterError = clubTab.slice(errorIdx, errorIdx + 400);
  assert.true(afterError.includes("DevTestAccountSwitcher"), "switcher on error");
});

console.log(`\n${passed} tests OK`);

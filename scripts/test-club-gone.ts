/**
 * Club disparu / id stale — empty + créer, pas l'erreur réseau.
 * Lancer : npx tsx scripts/test-club-gone.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import { clubReadOrNull, isGoneClubReadError, managedClubScreenState } from "../lib/clubRead";

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

test("useClub : maybeSingle + club gone = null ; jamais id null vers PostgREST", () => {
  const src = read("lib/hooks/useClubs.ts");
  assert.true(src.includes("clubReadOrNull"), "helper");
  assert.true(src.includes("maybeSingle"), "maybeSingle");
  assert.true(src.includes("if (!clubId) return null"), "queryFn no-op without id");
  assert.false(/\.eq\("id", clubId!\)/.test(src), "no clubId! eq");
  assert.false(/\.eq\("id", clubId!\)\s*\.single\(\)/.test(src), "no single on club read");
});

test("0 clubs / pas de data = empty même si isError (refetch TanStack)", () => {
  assert.equal(
    managedClubScreenState({ clubId: null, club: null, isLoading: false, isFetching: true, isError: true }),
    "empty",
    "null id + isError is empty"
  );
  assert.equal(
    managedClubScreenState({ clubId: null, club: null, isLoading: true, isFetching: true, isError: false }),
    "empty",
    "null id never loading skeleton"
  );
  assert.equal(
    managedClubScreenState({ clubId: "c1", club: null, isLoading: false, isFetching: false, isError: true }),
    "empty",
    "no club data = empty, not red"
  );
  assert.equal(
    managedClubScreenState({ clubId: "c1", club: null, isLoading: true, isFetching: false, isError: false }),
    "loading",
    "real id first load = loading"
  );
  assert.equal(
    managedClubScreenState({ clubId: "c1", club: { id: "c1" }, isLoading: false, isError: true }),
    "error",
    "club data + fail = error"
  );
  assert.equal(
    managedClubScreenState({ clubId: "c1", club: { id: "c1" }, isLoading: false, isError: false }),
    "ready",
    "ready"
  );
  const hook = read("lib/hooks/useManagedClub.ts");
  assert.true(hook.includes("if (!selectedManagedClubId) return Promise.resolve()"), "refetch no-op");
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
  const empty = read("components/club/ManagedClubEmpty.tsx");
  assert.true(empty.includes('title="Aucun club géré"'), "empty title");
  assert.true(empty.includes("Créer un club"), "create cta");
  assert.true(empty.includes('router.push("/create-club")'), "create route");
  assert.false(empty.includes("Impossible de charger ce club."), "empty is not error copy");

  const screens = [
    "app/(club)/(tabs)/index.tsx",
    "app/(club)/(tabs)/candidatures.tsx",
    "app/(club)/(tabs)/effectif.tsx",
    "app/(club)/(tabs)/match.tsx",
  ];
  for (const rel of screens) {
    const src = read(rel);
    assert.true(src.includes("<ManagedClubEmpty"), `${rel} empty component`);
    const emptyIf = src.indexOf("if (!club)");
    const errorIf = src.indexOf("if (isError)");
    assert.true(emptyIf >= 0, `${rel} if (!club)`);
    assert.true(errorIf >= 0, `${rel} if (isError)`);
    assert.true(emptyIf < errorIf, `${rel} empty BEFORE isError`);
    if (rel !== "app/(club)/(tabs)/match.tsx") {
      assert.true(src.includes('message="Impossible de charger ce club."'), `${rel} real error still exists`);
    }
  }

  const live = read("app/(club)/(tabs)/index.tsx");
  const clubTab = read("app/(club)/(tabs)/effectif.tsx");
  const match = read("app/(club)/(tabs)/match.tsx");
  for (const [rel, src] of [
    ["LIVE", live],
    ["Club", clubTab],
    ["match", match],
  ] as const) {
    assert.true(src.includes("if (!club) return"), `${rel} skip refetch without club`);
  }

  const rec = read("app/(club)/(tabs)/candidatures.tsx");
  assert.true(rec.includes("<ManagedClubEmpty"), "recrutement create empty");
  assert.true(rec.indexOf("if (!club)") < rec.indexOf("if (isError)"), "recrutement empty before error");
});

test("onglet Club : switcher même en empty et en erreur réseau", () => {
  const clubTab = read("app/(club)/(tabs)/effectif.tsx");
  const errorIdx = clubTab.indexOf('message="Impossible de charger ce club."');
  const afterError = clubTab.slice(errorIdx, errorIdx + 400);
  assert.true(afterError.includes("DevTestAccountSwitcher"), "switcher on error");
  const emptyIdx = clubTab.indexOf("<ManagedClubEmpty");
  const afterEmpty = clubTab.slice(emptyIdx, emptyIdx + 350);
  assert.true(afterEmpty.includes("DevTestAccountSwitcher"), "switcher on empty");
  assert.true(afterEmpty.includes('ModeLifeToggle target="PLAYER"'), "passer en joueur on empty");
});

console.log(`\n${passed} tests OK`);

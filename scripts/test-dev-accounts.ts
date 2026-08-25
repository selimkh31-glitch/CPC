/**
 * Comptes test DEV — emails figés, switcher __DEV__, pas de wipe DB.
 * Lancer : npx tsx scripts/test-dev-accounts.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import { CPC_DEV_TEST_ACCOUNT_EMAILS } from "../lib/devTestAccounts";

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

console.log("Comptes test DEV");

test("emails figés pour le seed CoS", () => {
  assert.equal(CPC_DEV_TEST_ACCOUNT_EMAILS.length, 5, "count");
  assert.true(CPC_DEV_TEST_ACCOUNT_EMAILS.includes("test-manager@cpc.dev"), "manager");
  assert.true(CPC_DEV_TEST_ACCOUNT_EMAILS.includes("test-gardien@cpc.dev"), "gardien");
  assert.true(CPC_DEV_TEST_ACCOUNT_EMAILS.includes("test-defenseur@cpc.dev"), "defenseur");
  assert.true(CPC_DEV_TEST_ACCOUNT_EMAILS.includes("test-milieu@cpc.dev"), "milieu");
  assert.true(CPC_DEV_TEST_ACCOUNT_EMAILS.includes("test-attaquant@cpc.dev"), "attaquant");
});

test("switcher Profil + Club, jamais LIVE, jamais wipe DB", () => {
  const switcher = read("components/profile/DevTestAccountSwitcher.tsx");
  const profile = read("app/(player)/(tabs)/profile.tsx");
  const clubTab = read("app/(club)/(tabs)/effectif.tsx");
  const liveClub = read("app/(club)/(tabs)/index.tsx");
  const livePlayer = read("app/(player)/(tabs)/index.tsx");
  assert.true(profile.includes("DevTestAccountSwitcher"), "profil");
  assert.true(clubTab.includes("DevTestAccountSwitcher"), "club identity");
  assert.false(liveClub.includes("DevTestAccountSwitcher"), "not on club LIVE");
  assert.false(livePlayer.includes("DevTestAccountSwitcher"), "not on player LIVE");
  assert.true(switcher.includes("__DEV__"), "dev guard");
  assert.true(switcher.includes("signInWithPassword"), "existing auth");
  assert.true(switcher.includes("signOut"), "reload session");
  assert.false(/from\(['\"]rpc/.test(switcher), "no rpc wipe");
  assert.false(switcher.includes("delete("), "no delete");
  assert.false(switcher.includes("truncate"), "no truncate");
  assert.false(switcher.includes("console.log"), "don't log password");
  assert.false(switcher.includes("CpcDevTest1"), "password not in UI");
});

test("mot de passe env ou fallback __DEV__, pas loggé", () => {
  const src = read("lib/devTestAccounts.ts");
  assert.true(src.includes("EXPO_PUBLIC_CPC_TEST_PASSWORD"), "env");
  assert.true(src.includes("CpcDevTest1!"), "dev fallback");
  assert.true(src.includes("__DEV__"), "dev only");
  assert.false(src.includes("console.log"), "no log");
  assert.false(src.includes("console.warn"), "no warn password");
});

console.log(`\n${passed} tests OK`);

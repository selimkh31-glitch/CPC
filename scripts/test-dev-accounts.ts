/**
 * Comptes test DEV — 13 emails seedés CoS, switcher __DEV__, pas de wipe DB.
 * Lancer : npx tsx scripts/test-dev-accounts.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import {
  CPC_DEV_TEST_ACCOUNT_EMAILS,
  CPC_DEV_TEST_SEED,
} from "../lib/devTestAccounts";

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

const SEEDED_EMAILS = [
  "test-manager@cpc.dev",
  "test-gardien@cpc.dev",
  "test-dc@cpc.dev",
  "test-ag@cpc.dev",
  "test-ad@cpc.dev",
  "test-mdc@cpc.dev",
  "test-mc@cpc.dev",
  "test-moc@cpc.dev",
  "test-mg@cpc.dev",
  "test-md@cpc.dev",
  "test-agile@cpc.dev",
  "test-ail@cpc.dev",
  "test-bu@cpc.dev",
] as const;

console.log("Comptes test DEV");

test("emails figés pour le seed CoS — 13, ordre exact, pas les anciens 5", () => {
  assert.equal(CPC_DEV_TEST_ACCOUNT_EMAILS.length, 13, "count");
  assert.equal(CPC_DEV_TEST_SEED.length, 13, "seed count");
  for (let i = 0; i < SEEDED_EMAILS.length; i += 1) {
    assert.equal(CPC_DEV_TEST_ACCOUNT_EMAILS[i], SEEDED_EMAILS[i], `email ${i}`);
    assert.equal(CPC_DEV_TEST_SEED[i].email, SEEDED_EMAILS[i], `seed email ${i}`);
  }
  const blob = CPC_DEV_TEST_ACCOUNT_EMAILS.join(" ");
  assert.false(blob.includes("test-defenseur@cpc.dev"), "no test-defenseur");
  assert.false(blob.includes("test-milieu@cpc.dev"), "no test-milieu");
  assert.false(blob.includes("test-attaquant@cpc.dev"), "no test-attaquant");
});

test("usernames cpc_* et postes du seed", () => {
  assert.equal(CPC_DEV_TEST_SEED[0].username, "cpc_manager", "manager user");
  assert.equal(CPC_DEV_TEST_SEED[0].position, "CM", "manager pos");
  assert.equal(CPC_DEV_TEST_SEED[1].username, "cpc_gk", "gk");
  assert.equal(CPC_DEV_TEST_SEED[1].position, "GK", "gk pos");
  assert.equal(CPC_DEV_TEST_SEED[2].username, "cpc_cb", "cb");
  assert.equal(CPC_DEV_TEST_SEED[12].username, "cpc_st", "st");
  assert.equal(CPC_DEV_TEST_SEED[12].position, "ST", "st pos");
  assert.equal(CPC_DEV_TEST_SEED[7].label, "Meneur", "cam label");
  assert.equal(CPC_DEV_TEST_SEED[10].email, "test-agile@cpc.dev", "lw email");
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
  assert.true(switcher.includes("CPC_DEV_TEST_ACCOUNTS"), "uses accounts list");
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

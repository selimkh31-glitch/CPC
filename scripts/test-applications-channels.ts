/**
 * Tests des canaux Realtime partagés (lib/hooks/useApplications.ts).
 * Sans client Supabase live : spec leftover + lecture source.
 *
 * Lancer : npx tsx scripts/test-applications-channels.ts
 */
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

/** Spec leftover — identique à `isLeftoverRealtimeTopic` (verrouillée par la source). */
function isLeftoverRealtimeTopic(channelTopic: string, topic: string): boolean {
  return channelTopic === topic || channelTopic === `realtime:${topic}` || channelTopic.endsWith(`:${topic}`);
}

console.log("lib/hooks/useApplications.ts — shared realtime channels");

test("isLeftoverRealtimeTopic — foo, realtime:foo, suffix :foo", () => {
  const topic = "my-applications-list-u1";
  assert.true(isLeftoverRealtimeTopic(topic, topic), "exact");
  assert.true(isLeftoverRealtimeTopic(`realtime:${topic}`, topic), "realtime: prefix");
  assert.true(isLeftoverRealtimeTopic(`other:${topic}`, topic), "ends with :topic");
  assert.false(isLeftoverRealtimeTopic("my-applications-list-u2", topic), "other user");
  assert.false(isLeftoverRealtimeTopic("applications-club1", topic), "other table");
});

test("source — leftover matcher + drop before create", () => {
  const src = read("lib/hooks/useApplications.ts");
  assert.true(
    src.includes("channelTopic === topic || channelTopic === `realtime:${topic}` || channelTopic.endsWith(`:${topic}`)"),
    "leftover spec in source"
  );
  assert.true(src.includes("export function dropLeftoverChannel"), "dropLeftoverChannel");
  assert.true(src.includes("export function acquireSharedChannel"), "acquireSharedChannel");
  assert.true(src.includes("export function releaseSharedChannel"), "releaseSharedChannel");
  assert.true(src.includes("dropLeftoverChannel(topic)"), "drop before create");
  assert.true(src.includes('event: "*"'), "single * callback");
});

test("source — 3 registres + club acquire passe par le partage", () => {
  const src = read("lib/hooks/useApplications.ts");
  assert.true(src.includes("const applicationsChannels"), "club registry");
  assert.true(src.includes("const myApplicationsListChannels"), "list registry");
  assert.true(src.includes("const myApplicationStatusChannels"), "status registry");
  assert.true(src.includes("acquireSharedChannel("), "shared acquire");
  assert.true(src.includes("`applications-${clubId}`"), "club topic");
  assert.true(src.includes("`my-applications-list-${userId}`"), "list topic");
  assert.true(src.includes("`my-applications-${userId}`"), "status topic");
  assert.true(src.includes("function acquireApplicationsChannel"), "club wrapper kept");
  assert.true(src.includes("function releaseApplicationsChannel"), "club release kept");
});

test("source — useMyApplications / status updates partagent, pas de .on après subscribe privé", () => {
  const src = read("lib/hooks/useApplications.ts");
  const myApps = src.slice(src.indexOf("export function useMyApplications"));
  const statusFn = src.slice(src.indexOf("export function useMyApplicationStatusUpdates"));
  assert.true(myApps.includes("acquireSharedChannel("), "list acquire");
  assert.true(myApps.includes("myApplicationsListChannels"), "list registry");
  assert.true(myApps.includes("releaseSharedChannel(myApplicationsListChannels"), "list release");
  assert.false(myApps.slice(0, myApps.indexOf("export function useWithdrawApplication")).includes(".subscribe()"), "list no private subscribe");
  assert.true(statusFn.includes("myApplicationStatusChannels"), "status registry");
  assert.true(statusFn.includes("if (!status) return"), "missing status no-op");
  assert.true(statusFn.includes("onChange(status)"), "onChange");
  assert.true(statusFn.includes("Haptics.notificationAsync"), "haptics");
  assert.true(statusFn.includes("releaseSharedChannel(myApplicationStatusChannels"), "status release");
  assert.false(statusFn.includes(".subscribe()"), "status no private subscribe");
});

test("HomeScreen + MyApplicationsList montent tous les deux useMyApplications", () => {
  const home = read("components/home/HomeScreen.tsx");
  const list = read("components/player/MyApplicationsList.tsx");
  assert.true(home.includes("useMyApplications"), "home");
  assert.true(list.includes("useMyApplications"), "list");
  assert.true(list.includes("useMyApplicationStatusUpdates"), "status hook");
});

console.log(`\n${passed} test(s) passés.`);

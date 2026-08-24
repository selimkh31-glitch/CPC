/**
 * Tests de lib/notificationRead.ts — décompte non-lus et miroir cache mark-all-read.
 * Sans réseau. Lancer : npx tsx scripts/test-notification-read.ts
 */
import { unreadNotificationCount, withAllNotificationsRead } from "../lib/notificationRead";
import type { NotificationRow } from "../lib/types";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
    }
  },
  true(actual: unknown, label: string) {
    if (actual !== true) throw new Error(`Assertion échouée (${label}) : attendu true, reçu ${actual}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

function row(partial: Pick<NotificationRow, "id" | "read_at">): NotificationRow {
  return {
    id: partial.id,
    user_id: "me",
    type: "MESSAGE_RECEIVED",
    title: "Nouveau message",
    body: "Un joueur t'a écrit.",
    data: { conversationId: "c1" },
    read_at: partial.read_at,
    created_at: "2026-08-24T12:00:00.000Z",
  };
}

console.log("lib/notificationRead.ts");

test("unreadNotificationCount — null = non lu, date = lu, liste vide = 0", () => {
  assert.equal(unreadNotificationCount([]), 0, "empty");
  assert.equal(
    unreadNotificationCount([
      row({ id: "a", read_at: null }),
      row({ id: "b", read_at: "2026-08-24T12:01:00.000Z" }),
      row({ id: "c", read_at: null }),
    ]),
    2,
    "mixed"
  );
});

test("withAllNotificationsRead — badge à 0, déjà-lues intactes, pas de ligne ajoutée", () => {
  const already = "2026-08-24T11:00:00.000Z";
  const now = "2026-08-24T12:30:00.000Z";
  const before = [
    row({ id: "a", read_at: null }),
    row({ id: "b", read_at: already }),
    row({ id: "c", read_at: null }),
  ];
  const after = withAllNotificationsRead(before, now);
  assert.equal(after.length, 3, "same length");
  assert.equal(after[0].read_at, now, "a marked");
  assert.equal(after[1].read_at, already, "b preserved");
  assert.equal(after[2].read_at, now, "c marked");
  assert.equal(unreadNotificationCount(after), 0, "badge 0");
  assert.equal(unreadNotificationCount(before), 2, "source intact");
});

test("withAllNotificationsRead — liste déjà lue reste à 0", () => {
  const readAt = "2026-08-24T10:00:00.000Z";
  const after = withAllNotificationsRead([row({ id: "x", read_at: readAt })], "2026-08-24T12:00:00.000Z");
  assert.equal(after[0].read_at, readAt, "unchanged");
  assert.equal(unreadNotificationCount(after), 0, "still 0");
});

console.log(`\n${passed} tests OK`);

/**
 * Tests de lib/recruitment.ts — transitions idempotentes.
 * Lancer : npx tsx scripts/test-recruitment.ts
 */
import {
  liveOffRecruitmentEvent,
  nextApplicationStatus,
  nextInvitationStatus,
} from "../lib/recruitment";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${actual}\n  attendu: ${expected}`);
    }
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

console.log("lib/recruitment.ts — états candidature / invitation");

test("PENDING → ACCEPT/DECLINE/CANCEL/EXPIRE/WITHDRAW", () => {
  assert.equal(nextApplicationStatus("PENDING", "ACCEPT"), "ACCEPTED", "accept");
  assert.equal(nextApplicationStatus("PENDING", "DECLINE"), "DECLINED", "decline");
  assert.equal(nextApplicationStatus("PENDING", "CANCEL"), "CANCELLED", "cancel");
  assert.equal(nextApplicationStatus("PENDING", "EXPIRE"), "EXPIRED", "expire");
  assert.equal(nextApplicationStatus("PENDING", "WITHDRAW"), "WITHDRAWN", "withdraw");
});

test("idempotence — ACCEPTED/EXPIRED/DECLINED ne retransitionnent pas", () => {
  for (const s of ["ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "WITHDRAWN", "REJECTED"] as const) {
    assert.equal(nextApplicationStatus(s, "ACCEPT"), null, `${s}+ACCEPT`);
    assert.equal(nextApplicationStatus(s, "EXPIRE"), null, `${s}+EXPIRE`);
  }
});

test("invitation PENDING → ACCEPT/DECLINE/CANCEL/EXPIRE", () => {
  assert.equal(nextInvitationStatus("PENDING", "ACCEPT"), "ACCEPTED", "accept");
  assert.equal(nextInvitationStatus("PENDING", "DECLINE"), "DECLINED", "decline");
  assert.equal(nextInvitationStatus("PENDING", "CANCEL"), "CANCELLED", "cancel");
  assert.equal(nextInvitationStatus("PENDING", "EXPIRE"), "EXPIRED", "expire");
});

test("invitation RESERVED/ACCEPTED : no-op", () => {
  assert.equal(nextInvitationStatus("RESERVED", "EXPIRE"), null, "reserved");
  assert.equal(nextInvitationStatus("ACCEPTED", "DECLINE"), null, "accepted");
  assert.equal(nextInvitationStatus("EXPIRED", "ACCEPT"), null, "expired");
});

test("liveOffRecruitmentEvent — TTL passé = EXPIRE, sinon CANCEL", () => {
  const now = Date.parse("2026-08-24T12:00:00.000Z");
  assert.equal(liveOffRecruitmentEvent("2026-08-24T11:59:00.000Z", now), "EXPIRE", "ttl");
  assert.equal(liveOffRecruitmentEvent("2026-08-24T14:00:00.000Z", now), "CANCEL", "manual");
  assert.equal(liveOffRecruitmentEvent(null, now), "CANCEL", "null expiry");
});

console.log(`\n${passed} tests recruitment OK`);

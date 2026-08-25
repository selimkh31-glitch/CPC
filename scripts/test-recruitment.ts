/**
 * Tests de lib/recruitment.ts — transitions idempotentes.
 * Lancer : npx tsx scripts/test-recruitment.ts
 */
import {
  liveOffRecruitmentEvent,
  nextApplicationStatus,
  nextInvitationStatus,
  recruitmentNotificationNav,
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

test("APPLICATION_RECEIVED → Recrutement + clubId (pas /club/[id])", () => {
  const nav = recruitmentNotificationNav("APPLICATION_RECEIVED", { clubId: "c1" });
  assert.equal(nav?.href, "/candidatures", "href");
  assert.equal(nav?.selectClubId, "c1", "club");
  assert.equal(nav?.requireClubMode, true, "club mode");
  assert.equal(recruitmentNotificationNav("APPLICATION_RECEIVED", {})?.selectClubId, null, "no club");
});

test("INVITATION_RECEIVED → Mes invitations (Accepter côté joueur)", () => {
  const nav = recruitmentNotificationNav("INVITATION_RECEIVED", { clubId: "c1", invitationId: "i1" });
  assert.equal(nav?.href, "/my-invitations", "href");
  assert.equal(nav?.requireClubMode, false, "player");
});

test("APPLICATION_ACCEPTED/DECLINED → Mes candidatures", () => {
  assert.equal(recruitmentNotificationNav("APPLICATION_ACCEPTED", {})?.href, "/my-applications", "accepted");
  assert.equal(recruitmentNotificationNav("APPLICATION_DECLINED", {})?.href, "/my-applications", "declined");
  assert.equal(recruitmentNotificationNav("MESSAGE_RECEIVED", { conversationId: "x" }), null, "not recruitment");
});

console.log(`\n${passed} tests recruitment OK`);

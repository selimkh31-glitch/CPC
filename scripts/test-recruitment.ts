/**
 * Tests de lib/recruitment.ts — transitions idempotentes.
 * Lancer : npx tsx scripts/test-recruitment.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import {
  liveOffRecruitmentEvent,
  nextApplicationStatus,
  nextInvitationStatus,
  playerInvitationAcceptHref,
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
  assert.equal(nextInvitationStatus("RESERVED", "CANCEL"), null, "reserved cancel");
  assert.equal(nextInvitationStatus("ACCEPTED", "DECLINE"), null, "accepted");
  assert.equal(nextInvitationStatus("ACCEPTED", "CANCEL"), null, "accepted cancel");
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

test("INVITATION_ACCEPTED/DECLINED → Recrutement + clubId (pas /club/[id])", () => {
  const accepted = recruitmentNotificationNav("INVITATION_ACCEPTED", { clubId: "c2" });
  assert.equal(accepted?.href, "/candidatures", "accepted href");
  assert.equal(accepted?.selectClubId, "c2", "accepted club");
  assert.equal(accepted?.requireClubMode, true, "accepted club mode");
  const declined = recruitmentNotificationNav("INVITATION_DECLINED", { clubId: "c2" });
  assert.equal(declined?.href, "/candidatures", "declined href");
  assert.equal(declined?.selectClubId, "c2", "declined club");
  assert.equal(declined?.requireClubMode, true, "declined club mode");
  assert.equal(recruitmentNotificationNav("INVITATION_ACCEPTED", {})?.selectClubId, null, "accepted no club");
  assert.equal(recruitmentNotificationNav("INVITATION_ACCEPTED", {})?.href, "/candidatures", "accepted missing club href");
  assert.equal(recruitmentNotificationNav("INVITATION_DECLINED", {})?.selectClubId, null, "declined no club");
  assert.equal(recruitmentNotificationNav("INVITATION_DECLINED", {})?.href, "/candidatures", "declined missing club href");
  assert.equal(recruitmentNotificationNav("INVITATION_ACCEPTED", { clubId: "" })?.selectClubId, null, "empty clubId");
});

test("INVITATION_RECEIVED → Mes invitations (Accepter côté joueur)", () => {
  const nav = recruitmentNotificationNav("INVITATION_RECEIVED", { clubId: "c1", invitationId: "i1" });
  assert.equal(nav?.href, "/my-invitations", "href");
  assert.equal(nav?.requireClubMode, false, "player");
});

test("INVITATION_CANCELLED → Mes invitations (joueur)", () => {
  const nav = recruitmentNotificationNav("INVITATION_CANCELLED", { clubId: "c1", invitationId: "i1" });
  assert.equal(nav?.href, "/my-invitations", "href");
  assert.equal(nav?.requireClubMode, false, "player");
});

test("APPLICATION_ACCEPTED/DECLINED → Mes candidatures", () => {
  assert.equal(recruitmentNotificationNav("APPLICATION_ACCEPTED", {})?.href, "/my-applications", "accepted");
  assert.equal(recruitmentNotificationNav("APPLICATION_DECLINED", {})?.href, "/my-applications", "declined");
  assert.equal(recruitmentNotificationNav("MESSAGE_RECEIVED", { conversationId: "x" }), null, "not recruitment");
  assert.equal(recruitmentNotificationNav("MATCH_FINALIZED", { clubId: "c1" }), null, "match not recruitment");
  assert.equal(
    recruitmentNotificationNav("COMPETITION_CLUB_REGISTERED", { competitionId: "comp-1" }),
    null,
    "register not recruitment"
  );
  assert.equal(
    recruitmentNotificationNav("TOURNAMENT_ROUND_SCHEDULED", { competitionId: "t-1", kind: "TOURNAMENT", round: 1 }),
    null,
    "tournament schedule not recruitment"
  );
});

test("joueur ACCEPTED → feuille /match-sheet, jamais Recrutement", () => {
  assert.equal(playerInvitationAcceptHref("club-1"), "/match-sheet?clubId=club-1", "href");
  assert.equal(playerInvitationAcceptHref("  "), null, "blank");
  assert.equal(playerInvitationAcceptHref(null), null, "null");
  assert.equal(playerInvitationAcceptHref(undefined), null, "undefined");
  const list = readFileSync(`${process.cwd()}/components/player/MyInvitationsList.tsx`, "utf8");
  assert.equal(list.includes("playerInvitationAcceptHref"), true, "list uses helper");
  assert.equal(list.includes("router.push(href)"), true, "navigates");
  assert.equal(list.includes("/candidatures"), false, "not recrutement");
});

test("cancel-invitation — Edge + hook + Annuler PENDING + re-invite CANCELLED", () => {
  const edge = readFileSync(`${process.cwd()}/supabase/functions/cancel-invitation/index.ts`, "utf8");
  assert.equal(edge.includes("getCallingUser"), true, "auth");
  assert.equal(edge.includes('["OWNER", "MANAGER"]'), true, "manager only");
  assert.equal(edge.includes('nextInvitationStatus'), true, "transition");
  assert.equal(edge.includes('"CANCEL"'), true, "cancel event");
  assert.equal(edge.includes('.eq("status", "PENDING")') || edge.includes(".eq('status','PENDING')") || edge.includes('.eq("status","PENDING")'), true, "pending guard");
  assert.equal(edge.includes("INVITATION_CANCELLED"), true, "notif type");
  assert.equal(edge.includes("RESERVED"), false, "no reserved cancel path");
  const hooks = readFileSync(`${process.cwd()}/lib/hooks/useInvitations.ts`, "utf8");
  assert.equal(hooks.includes("useCancelInvitation"), true, "hook");
  assert.equal(hooks.includes('"cancel-invitation"'), true, "edge name");
  assert.equal(hooks.includes('["club-invitations"'), true, "invalidate club");
  assert.equal(hooks.includes('["my-invitations"]'), true, "invalidate mine");
  const recPanel = readFileSync(`${process.cwd()}/components/club/ClubInvitationsPanel.tsx`, "utf8");
  assert.equal(recPanel.includes("useCancelInvitation"), true, "panel hook");
  assert.equal(recPanel.includes("Annuler"), true, "panel CTA");
  assert.equal(recPanel.includes('inv.status === "PENDING"'), true, "pending only");
  const feuille = readFileSync(`${process.cwd()}/components/club/ClubLiveFeuille.tsx`, "utf8");
  assert.equal(feuille.includes("useCancelInvitation"), true, "feuille hook");
  assert.equal(feuille.includes("Annuler"), true, "feuille CTA");
  const invite = readFileSync(`${process.cwd()}/components/club/InviteToClubPanel.tsx`, "utf8");
  assert.equal(invite.includes('status === "DECLINED" || status === "CANCELLED"'), true, "re-invite after cancel");
  const unique = readFileSync(`${process.cwd()}/supabase/migrations/0015_invitations_one_pending_per_club_user.sql`, "utf8");
  assert.equal(unique.includes("where status = 'PENDING'"), true, "unique pending only");
  const toml = readFileSync(`${process.cwd()}/supabase/config.toml`, "utf8");
  assert.equal(toml.includes("[functions.cancel-invitation]"), true, "toml");
});

console.log(`\n${passed} tests recruitment OK`);

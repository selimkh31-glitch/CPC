/**
 * Tests de lib/safety.ts + lib/statsSource.ts — block bidirectionnel,
 * href notifications, sources EA/CPC sans identité joueur inventée.
 * Lancer : npx tsx scripts/test-safety.ts
 */
import {
  isNotificationType,
  isReportReason,
  messageReceivedCopy,
  NOTIFICATION_TYPE_LABELS,
  notificationHref,
  notificationTitle,
  inAppNotificationHref,
  otherConversationParticipantIds,
  otherIdsFromBlocks,
  pairIsBlocked,
  REPORT_REASONS,
  shouldNotifyMessageReceived,
} from "../lib/safety";
import { eaIdentityBadge, normalizeEaIdentityKind, statsSourceLabel } from "../lib/statsSource";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${actual}\n  attendu: ${expected}`);
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

console.log("lib/safety.ts + lib/statsSource.ts");

test("REPORT_REASONS couvre le formulaire (pas de motif inventé hors liste)", () => {
  assert.true(isReportReason("HARASSMENT"), "harassment");
  assert.true(isReportReason("CHEATING"), "cheating");
  assert.false(isReportReason("IRL_VIOLENCE"), "hors liste");
  assert.equal(REPORT_REASONS.length, 5, "count");
});

test("pairIsBlocked est bidirectionnel et ignore self", () => {
  const blocks = [{ blocker_id: "a", blocked_id: "b" }];
  assert.true(pairIsBlocked(blocks, "a", "b"), "a→b");
  assert.true(pairIsBlocked(blocks, "b", "a"), "b→a");
  assert.false(pairIsBlocked(blocks, "a", "c"), "a→c");
  assert.false(pairIsBlocked(blocks, "a", "a"), "self");
});

test("otherIdsFromBlocks — les deux sens pour hide discovery", () => {
  const blocks = [
    { blocker_id: "me", blocked_id: "x" },
    { blocker_id: "y", blocked_id: "me" },
  ];
  const ids = otherIdsFromBlocks(blocks, "me").sort();
  assert.equal(ids.join(","), "x,y", "ids");
});

test("notificationHref — apply/invite/accept/decline ont une cible réelle", () => {
  assert.equal(notificationHref("APPLICATION_RECEIVED", { clubId: "c1" }), "/club/c1", "received");
  assert.equal(notificationHref("APPLICATION_ACCEPTED", {}), "/my-applications", "accepted");
  assert.equal(notificationHref("APPLICATION_DECLINED", {}), "/my-applications", "declined");
  assert.equal(notificationHref("INVITATION_RECEIVED", {}), "/my-invitations", "inv recv");
  assert.equal(notificationHref("INVITATION_ACCEPTED", { clubId: "c2" }), "/club/c2", "inv acc");
  assert.equal(notificationHref("INVITATION_DECLINED", { clubId: "c2" }), "/club/c2", "inv dec");
  assert.true(isNotificationType("APPLICATION_RECEIVED"), "known type");
  assert.false(isNotificationType("RANDOM"), "unknown type");
});

test("inAppNotificationHref — APPLICATION_RECEIVED en Mode Club va à Recrutement", () => {
  assert.equal(
    inAppNotificationHref("APPLICATION_RECEIVED", { clubId: "c1" }, "CLUB"),
    "/candidatures",
    "club mode"
  );
  assert.equal(
    inAppNotificationHref("APPLICATION_RECEIVED", { clubId: "c1" }, "PLAYER"),
    "/club/c1",
    "player mode — arbre club non monté"
  );
  assert.equal(
    inAppNotificationHref("MESSAGE_RECEIVED", { conversationId: "conv-1" }, "CLUB"),
    "/conversation/conv-1",
    "dm inchangé"
  );
});

test("MESSAGE_RECEIVED — type, label FR, href conversation", () => {
  assert.true(isNotificationType("MESSAGE_RECEIVED"), "known type");
  assert.equal(NOTIFICATION_TYPE_LABELS.MESSAGE_RECEIVED, "Nouveau message", "label");
  assert.equal(notificationTitle("MESSAGE_RECEIVED", "x"), "Nouveau message", "title");
  assert.equal(
    notificationHref("MESSAGE_RECEIVED", { conversationId: "conv-1" }),
    "/conversation/conv-1",
    "href"
  );
  assert.equal(notificationHref("MESSAGE_RECEIVED", {}), "/notifications", "href fallback");
  assert.equal(notificationHref("MESSAGE_RECEIVED", { conversationId: "" }), "/notifications", "empty id");
  assert.equal(notificationTitle("RANDOM", "Autre"), "Autre", "unknown fallback");
  assert.equal(notificationTitle("APPLICATION_RECEIVED", "x"), "Nouvelle candidature", "apply label");
  const copy = messageReceivedCopy("  Striker27  ");
  assert.equal(copy.type, "MESSAGE_RECEIVED", "copy type");
  assert.equal(copy.title, "Nouveau message", "copy title");
  assert.equal(copy.body, "Striker27 t'a écrit.", "copy body");
  assert.equal(messageReceivedCopy("   ").body, "Un joueur t'a écrit.", "copy fallback");
});

test("shouldNotifyMessageReceived — DIRECT only, skip self / blocked / deleted", () => {
  const base = { conversationType: "DIRECT", senderId: "a", recipientId: "b", blocked: false };
  assert.true(shouldNotifyMessageReceived(base), "dm ok");
  assert.false(shouldNotifyMessageReceived({ ...base, conversationType: "GROUP" }), "group");
  assert.false(shouldNotifyMessageReceived({ ...base, conversationType: "CLUB" }), "club");
  assert.false(shouldNotifyMessageReceived({ ...base, recipientId: "a" }), "self");
  assert.false(shouldNotifyMessageReceived({ ...base, blocked: true }), "blocked");
  assert.false(shouldNotifyMessageReceived({ ...base, deleted: true }), "deleted");
  assert.equal(otherConversationParticipantIds(["a", "b", "a"], "a").join(","), "b", "other ids");
  assert.equal(otherConversationParticipantIds(["a"], "a").join(","), "", "solo");
});

test("statsSource — labels et identité EA honnête (pas verified player id)", () => {
  assert.equal(statsSourceLabel("EA"), "EA (club lié)", "ea");
  assert.equal(statsSourceLabel("CPC"), "CPC", "cpc");
  assert.equal(statsSourceLabel("CALCULATED"), "Calculé CPC", "calc");
  assert.equal(normalizeEaIdentityKind("USERNAME_EQUALITY"), "USERNAME_EQUALITY", "kind");
  assert.equal(normalizeEaIdentityKind("VERIFIED_PLAYER_ID"), "NONE", "fake kind → NONE");
  const none = eaIdentityBadge("NONE");
  assert.false(none.show, "none hide");
  const eq = eaIdentityBadge("USERNAME_EQUALITY");
  assert.true(eq.show, "eq show");
  if (!eq.hint.includes("pas un id joueur EA")) {
    throw new Error("le hint doit nier l'id joueur EA vérifié");
  }
});

test("masquer est bidirectionnel ; débloquer ne concerne que mes propres blocs", () => {
  const blocks = [
    { blocker_id: "me", blocked_id: "x" },
    { blocker_id: "y", blocked_id: "me" },
  ];
  const hidden = otherIdsFromBlocks(blocks, "me");
  assert.true(hidden.includes("x") && hidden.includes("y"), "hide both");
  const iBlocked = blocks.filter((b) => b.blocker_id === "me").map((b) => b.blocked_id);
  assert.equal(iBlocked.join(","), "x", "unblock only x");
});

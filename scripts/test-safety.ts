/**
 * Tests de lib/safety.ts + lib/statsSource.ts — block bidirectionnel,
 * href notifications, sources EA/CPC sans identité joueur inventée.
 * Lancer : npx tsx scripts/test-safety.ts
 */
import {
  isNotificationType,
  isReportReason,
  matchFinalizedCopy,
  matchFinalizedHref,
  matchFinalizedNotificationNav,
  matchFinalizedRecipientIds,
  messageReceivedCopy,
  competitionClubRegisteredCopy,
  competitionClubRegisteredHref,
  competitionClubRegisteredRecipientIds,
  NOTIFICATION_TYPE_LABELS,
  notificationHref,
  notificationTitle,
  inAppNotificationHref,
  isClubHiddenByBlock,
  filterClubsHiddenByBlock,
  otherConversationParticipantIds,
  otherIdsFromBlocks,
  pairIsBlocked,
  REPORT_REASONS,
  shouldHideContactCta,
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

test("inAppNotificationHref — APPLICATION_RECEIVED va à Recrutement (accepter/refuser)", () => {
  assert.equal(
    inAppNotificationHref("APPLICATION_RECEIVED", { clubId: "c1" }, "CLUB"),
    "/candidatures",
    "club mode"
  );
  assert.equal(
    inAppNotificationHref("APPLICATION_RECEIVED", { clubId: "c1" }, "PLAYER"),
    "/candidatures",
    "player mode — même cible, l'appelant passe en Mode Club"
  );
  assert.equal(
    inAppNotificationHref("MESSAGE_RECEIVED", { conversationId: "conv-1" }, "CLUB"),
    "/conversation/conv-1",
    "dm inchangé"
  );
});

test("MATCH_FINALIZED — type, label FR, href /match ou /competitions/[id]", () => {
  assert.true(isNotificationType("MATCH_FINALIZED"), "known type");
  assert.equal(NOTIFICATION_TYPE_LABELS.MATCH_FINALIZED, "Résultat de match", "label");
  assert.equal(notificationTitle("MATCH_FINALIZED", "x"), "Résultat de match", "title");
  assert.equal(notificationHref("MATCH_FINALIZED", { clubId: "c1" }), "/match", "href club");
  assert.equal(
    notificationHref("MATCH_FINALIZED", { clubId: "c1", competitionId: "comp-1" }),
    "/competitions/comp-1",
    "href competition"
  );
  assert.equal(notificationHref("MATCH_FINALIZED", { competitionId: "" }), "/match", "empty competition");
  assert.equal(inAppNotificationHref("MATCH_FINALIZED", { clubId: "c1" }, "CLUB"), "/match", "in-app club");
  assert.equal(
    inAppNotificationHref("MATCH_FINALIZED", { clubId: "c1" }, "PLAYER"),
    "/match",
    "in-app player — même feuille, l'appelant passe en Mode Club"
  );
  assert.equal(
    inAppNotificationHref("MATCH_FINALIZED", { clubId: "c1", competitionId: "comp-1" }, "CLUB"),
    "/competitions/comp-1",
    "in-app club + compétition"
  );
  assert.equal(
    inAppNotificationHref("MATCH_FINALIZED", { clubId: "c1", competitionId: "comp-1" }, "PLAYER"),
    "/competitions/comp-1",
    "in-app player + compétition"
  );
  assert.equal(matchFinalizedHref({ clubId: "c1" }, "CLUB"), "/match", "helper club");
  assert.equal(matchFinalizedHref({ competitionId: "comp-1" }, "PLAYER"), "/competitions/comp-1", "helper competition");
  assert.equal(
    matchFinalizedHref({ competitionId: "t-1", kind: "TOURNAMENT" }, "PLAYER"),
    "/tournaments/t-1",
    "helper tournament"
  );
  assert.equal(
    notificationHref("MATCH_FINALIZED", { competitionId: "t-1", kind: "TOURNAMENT" }),
    "/tournaments/t-1",
    "href tournament"
  );
  const navMatch = matchFinalizedNotificationNav("MATCH_FINALIZED", { clubId: "c1" }, "CLUB");
  assert.equal(navMatch?.href, "/match", "nav href");
  assert.equal(navMatch?.requireClubMode, true, "nav club mode");
  assert.equal(navMatch?.selectClubId, "c1", "nav clubId");
  const navComp = matchFinalizedNotificationNav("MATCH_FINALIZED", { competitionId: "comp-1" }, "PLAYER");
  assert.equal(navComp?.href, "/competitions/comp-1", "nav competitions");
  assert.equal(navComp?.requireClubMode, false, "nav competitions no club mode");
  const navTourney = matchFinalizedNotificationNav(
    "MATCH_FINALIZED",
    { competitionId: "t-1", kind: "TOURNAMENT" },
    "PLAYER"
  );
  assert.equal(navTourney?.href, "/tournaments/t-1", "nav tournaments");
  assert.equal(navTourney?.requireClubMode, false, "nav tournaments no club mode");
  assert.equal(matchFinalizedNotificationNav("MESSAGE_RECEIVED", { clubId: "c1" }, "CLUB"), null, "not match");
  const copy = matchFinalizedCopy({ clubName: "  CPC United  ", opponentClubName: " Rival FC ", ourScore: 3, opponentScore: 1 });
  assert.equal(copy.type, "MATCH_FINALIZED", "copy type");
  assert.equal(copy.title, "Résultat de match", "copy title");
  assert.equal(copy.body, "CPC United 3 — 1 Rival FC.", "copy body");
  assert.equal(
    matchFinalizedCopy({ clubName: "   ", ourScore: 0, opponentScore: 0 }).body,
    "Ton club 0 — 0.",
    "copy fallback"
  );
});

test("matchFinalizedRecipientIds — membres des deux clubs, pas le recorder", () => {
  const ids = matchFinalizedRecipientIds({
    recordingClubMemberIds: ["recorder", "a", "a", ""],
    opponentClubMemberIds: ["b", "recorder", "c"],
    recorderId: "recorder",
  }).sort();
  assert.equal(ids.join(","), "a,b,c", "union minus recorder");
  assert.equal(
    matchFinalizedRecipientIds({ recordingClubMemberIds: ["recorder"], recorderId: "recorder" }).join(","),
    "",
    "recorder only"
  );
  assert.equal(
    matchFinalizedRecipientIds({
      recordingClubMemberIds: ["a"],
      opponentClubMemberIds: [],
      recorderId: "recorder",
    }).join(","),
    "a",
    "no opponent"
  );
});

test("COMPETITION_CLUB_REGISTERED — type, label FR, href /competitions/[id]", () => {
  assert.true(isNotificationType("COMPETITION_CLUB_REGISTERED"), "known type");
  assert.equal(NOTIFICATION_TYPE_LABELS.COMPETITION_CLUB_REGISTERED, "Club inscrit", "label");
  assert.equal(notificationTitle("COMPETITION_CLUB_REGISTERED", "x"), "Club inscrit", "title");
  assert.equal(
    notificationHref("COMPETITION_CLUB_REGISTERED", { clubId: "c1", competitionId: "comp-1" }),
    "/competitions/comp-1",
    "href"
  );
  assert.equal(notificationHref("COMPETITION_CLUB_REGISTERED", {}), "/competitions", "href empty data");
  assert.equal(competitionClubRegisteredHref({ clubId: "c1" }), "/competitions", "helper sans id");
  assert.equal(
    competitionClubRegisteredHref({ clubId: "c1", competitionId: "comp-1" }),
    "/competitions/comp-1",
    "helper"
  );
  assert.equal(
    competitionClubRegisteredHref({ clubId: "c1", competitionId: "t-1", kind: "TOURNAMENT" }),
    "/tournaments/t-1",
    "helper tournament"
  );
  assert.equal(
    notificationHref("COMPETITION_CLUB_REGISTERED", { clubId: "c1", competitionId: "t-1", kind: "TOURNAMENT" }),
    "/tournaments/t-1",
    "href tournament"
  );
  assert.equal(
    inAppNotificationHref("COMPETITION_CLUB_REGISTERED", { clubId: "c1", competitionId: "comp-1" }, "CLUB"),
    "/competitions/comp-1",
    "in-app club"
  );
  assert.equal(
    inAppNotificationHref("COMPETITION_CLUB_REGISTERED", { clubId: "c1" }, "PLAYER"),
    "/competitions",
    "in-app player sans id"
  );
  assert.equal(
    inAppNotificationHref("COMPETITION_CLUB_REGISTERED", { clubId: "c1", competitionId: "t-1", kind: "TOURNAMENT" }, "PLAYER"),
    "/tournaments/t-1",
    "in-app tournament"
  );
  const copy = competitionClubRegisteredCopy({
    clubName: "  CPC United  ",
    competitionName: "  Coupe du jeudi  ",
  });
  assert.equal(copy.type, "COMPETITION_CLUB_REGISTERED", "copy type");
  assert.equal(copy.title, "Club inscrit", "copy title");
  assert.equal(copy.body, "CPC United s'est inscrit à Coupe du jeudi.", "copy body");
  assert.equal(
    competitionClubRegisteredCopy({ clubName: "   ", competitionName: "  " }).body,
    "Un club s'est inscrit à une compétition.",
    "copy fallback"
  );
});

test("competitionClubRegisteredRecipientIds — created_by + OWNER/MANAGER, pas de doublon, pas MEMBER", () => {
  const ids = competitionClubRegisteredRecipientIds({
    createdBy: "creator",
    clubMembers: [
      { userId: "creator", role: "OWNER" },
      { userId: "manager", role: "MANAGER" },
      { userId: "member", role: "MEMBER" },
      { userId: "manager", role: "MANAGER" },
      { userId: "", role: "OWNER" },
    ],
  }).sort();
  assert.equal(ids.join(","), "creator,manager", "union minus member/dup");
  assert.equal(
    competitionClubRegisteredRecipientIds({
      createdBy: null,
      clubMembers: [{ userId: "owner", role: "OWNER" }],
    }).join(","),
    "owner",
    "no created_by"
  );
  assert.equal(
    competitionClubRegisteredRecipientIds({
      createdBy: "creator",
      clubMembers: [{ userId: "member", role: "MEMBER" }],
    }).join(","),
    "creator",
    "member excluded"
  );
  assert.equal(
    competitionClubRegisteredRecipientIds({ createdBy: "", clubMembers: [] }).join(","),
    "",
    "empty"
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

test("isClubHiddenByBlock — même règle LIVE/matching (owner, les deux sens)", () => {
  const blocked = otherIdsFromBlocks(
    [
      { blocker_id: "me", blocked_id: "owner-a" },
      { blocker_id: "owner-b", blocked_id: "me" },
    ],
    "me"
  );
  assert.true(isClubHiddenByBlock({ owner_id: "owner-a" }, blocked), "j'ai bloqué le owner");
  assert.true(isClubHiddenByBlock({ owner_id: "owner-b" }, blocked), "le owner m'a bloqué");
  assert.false(isClubHiddenByBlock({ owner_id: "owner-ok" }, blocked), "owner libre");
  assert.true(
    isClubHiddenByBlock({ owner_id: "other", owner: { id: "owner-a" } }, blocked),
    "owner.id fallback"
  );
  assert.false(isClubHiddenByBlock(null, blocked), "pas de club");
  assert.false(isClubHiddenByBlock({ owner_id: "" }, blocked), "owner vide");
  const visible = filterClubsHiddenByBlock(
    [
      { id: "c1", owner_id: "owner-a", name: "Blocked FC" },
      { id: "c2", owner_id: "owner-ok", name: "Open FC" },
      { id: "c3", owner_id: "owner-b", name: "Blocked Me FC" },
    ],
    blocked
  );
  assert.equal(visible.map((c) => c.id).join(","), "c2", "adversaire / annuaire");
});

test("shouldHideContactCta — même règle profils ; pas de user = pas de CTA à cacher", () => {
  assert.true(shouldHideContactCta("x", ["x", "y"]), "blocked");
  assert.false(shouldHideContactCta("z", ["x"]), "libre");
  assert.false(shouldHideContactCta(null, ["x"]), "pas de participant user");
  assert.false(shouldHideContactCta("x", null), "pas de blocs");
});

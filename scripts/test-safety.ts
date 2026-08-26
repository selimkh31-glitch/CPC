/**
 * Tests de lib/safety.ts + lib/statsSource.ts — block bidirectionnel,
 * href notifications, sources EA/CPC sans identité joueur inventée.
 * Lancer : npx tsx scripts/test-safety.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
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
  tournamentRoundScheduledCopy,
  tournamentRoundScheduledHref,
  tournamentRoundScheduledNotificationData,
  tournamentRoundScheduledNotificationNav,
  tournamentRoundScheduledRecipientIds,
  tournamentRoundScheduledClubIds,
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
import { competitionLinkedMatchNav } from "../lib/competitions";
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
  assert.equal(notificationHref("INVITATION_CANCELLED", {}), "/my-invitations", "inv cancelled");
  assert.equal(notificationHref("INVITATION_ACCEPTED", { clubId: "c2" }), "/candidatures", "inv acc");
  assert.equal(notificationHref("INVITATION_DECLINED", { clubId: "c2" }), "/candidatures", "inv dec");
  assert.equal(notificationHref("INVITATION_ACCEPTED", {}), "/candidatures", "inv acc no club");
  assert.equal(notificationHref("INVITATION_DECLINED", {}), "/candidatures", "inv dec no club");
  assert.equal(notificationHref("INVITATION_ACCEPTED", { clubId: "" }), "/candidatures", "inv acc empty club");
  assert.true(isNotificationType("APPLICATION_RECEIVED"), "known type");
  assert.true(isNotificationType("INVITATION_CANCELLED"), "cancel type");
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

test("inAppNotificationHref — INVITATION_CANCELLED va aux invitations joueur", () => {
  assert.equal(
    inAppNotificationHref("INVITATION_CANCELLED", { clubId: "c2" }, "PLAYER"),
    "/my-invitations",
    "player"
  );
  assert.equal(
    inAppNotificationHref("INVITATION_CANCELLED", { clubId: "c2" }, "CLUB"),
    "/my-invitations",
    "club mode still player dest"
  );
});

test("inAppNotificationHref — INVITATION_ACCEPTED/DECLINED va à Recrutement (pas /club/[id])", () => {
  assert.equal(
    inAppNotificationHref("INVITATION_ACCEPTED", { clubId: "c2" }, "CLUB"),
    "/candidatures",
    "accepted club mode"
  );
  assert.equal(
    inAppNotificationHref("INVITATION_ACCEPTED", { clubId: "c2" }, "PLAYER"),
    "/candidatures",
    "accepted player mode — même cible, l'appelant passe en Mode Club"
  );
  assert.equal(
    inAppNotificationHref("INVITATION_DECLINED", { clubId: "c2" }, "CLUB"),
    "/candidatures",
    "declined club mode"
  );
  assert.equal(
    inAppNotificationHref("INVITATION_DECLINED", {}, "PLAYER"),
    "/candidatures",
    "declined missing clubId"
  );
});

test("MATCH_FINALIZED — type, label FR, href /club/[id] ou compétition/tournoi", () => {
  assert.true(isNotificationType("MATCH_FINALIZED"), "known type");
  assert.equal(NOTIFICATION_TYPE_LABELS.MATCH_FINALIZED, "Résultat de match", "label");
  assert.equal(notificationTitle("MATCH_FINALIZED", "x"), "Résultat de match", "title");
  assert.equal(notificationHref("MATCH_FINALIZED", { clubId: "c1" }), "/club/c1", "href club");
  assert.equal(
    notificationHref("MATCH_FINALIZED", { clubId: "c1", competitionId: "comp-1" }),
    "/competitions/comp-1",
    "href competition"
  );
  assert.equal(notificationHref("MATCH_FINALIZED", { competitionId: "" }), "/notifications", "empty competition, no clubId");
  assert.equal(inAppNotificationHref("MATCH_FINALIZED", { clubId: "c1" }, "CLUB"), "/club/c1", "in-app club casual");
  assert.equal(
    inAppNotificationHref("MATCH_FINALIZED", { clubId: "c1" }, "PLAYER"),
    "/club/c1",
    "in-app player casual — même historique, pas de Mode Club"
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
  assert.equal(matchFinalizedHref({ clubId: "c1" }, "CLUB"), "/club/c1", "helper club CLUB");
  assert.equal(matchFinalizedHref({ clubId: "c1" }, "PLAYER"), "/club/c1", "helper club PLAYER");
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
  assert.equal(matchFinalizedHref({}, "PLAYER"), "/notifications", "missing clubId");
  assert.equal(matchFinalizedHref({ competitionId: "" }, "CLUB"), "/notifications", "empty competitionId");
  if (matchFinalizedHref({ clubId: "c1" }, "PLAYER") === "/match") {
    throw new Error("casual MATCH_FINALIZED ne doit pas aller sur /match");
  }
  if (matchFinalizedHref({}, "CLUB") === "/match" || matchFinalizedHref({}, "CLUB") === "/match-sheet") {
    throw new Error("fallback MATCH_FINALIZED ne doit pas aller sur /match");
  }
  const navClub = matchFinalizedNotificationNav("MATCH_FINALIZED", { clubId: "c1" }, "CLUB");
  assert.equal(navClub?.href, "/club/c1", "nav CLUB casual href");
  assert.equal(navClub?.requireClubMode, false, "nav CLUB casual no club mode");
  assert.equal(navClub?.selectClubId, null, "nav CLUB casual no select");
  const navPlayer = matchFinalizedNotificationNav("MATCH_FINALIZED", { clubId: "c1" }, "PLAYER");
  assert.equal(navPlayer?.href, "/club/c1", "nav PLAYER casual href");
  assert.equal(navPlayer?.requireClubMode, false, "nav PLAYER casual no club mode");
  assert.equal(navPlayer?.selectClubId, null, "nav PLAYER casual no select");
  const navOpponent = matchFinalizedNotificationNav("MATCH_FINALIZED", { clubId: "c1" }, "PLAYER");
  assert.equal(navOpponent?.href, "/club/c1", "opponent member same dest");
  assert.equal(navOpponent?.requireClubMode, false, "opponent no club mode");
  const navMissing = matchFinalizedNotificationNav("MATCH_FINALIZED", {}, "PLAYER");
  assert.equal(navMissing?.href, "/notifications", "missing clubId fallback");
  assert.equal(navMissing?.requireClubMode, false, "missing clubId no club mode");
  if (navMissing?.href === "/match" || navMissing?.href === "/match-sheet") {
    throw new Error("missing clubId ne doit pas aller sur /match");
  }
  const navComp = matchFinalizedNotificationNav("MATCH_FINALIZED", { competitionId: "comp-1" }, "PLAYER");
  assert.equal(navComp?.href, "/competitions/comp-1", "nav competitions");
  assert.equal(navComp?.requireClubMode, false, "nav competitions no club mode");
  assert.equal(navComp?.selectClubId, null, "nav competitions no select");
  const navTourney = matchFinalizedNotificationNav(
    "MATCH_FINALIZED",
    { competitionId: "t-1", kind: "TOURNAMENT" },
    "PLAYER"
  );
  assert.equal(navTourney?.href, "/tournaments/t-1", "nav tournaments");
  assert.equal(navTourney?.requireClubMode, false, "nav tournaments no club mode");
  assert.equal(navTourney?.selectClubId, null, "nav tournaments no select");
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

test("played linked match VIEW : même dest MATCH_FINALIZED, jamais /match", () => {
  const competition = competitionLinkedMatchNav({
    recordingClubId: "c1",
    managedClubIds: ["c1"],
    competitionId: "comp-1",
    kind: "COMPETITION",
  });
  const matchNav = matchFinalizedNotificationNav("MATCH_FINALIZED", { competitionId: "comp-1" }, "CLUB");
  assert.equal(competition?.href, matchNav?.href, "competition dest");
  assert.equal(competition?.href, "/competitions/comp-1", "competitions");
  assert.equal(competition?.requireClubMode, false, "no club mode");
  assert.equal(competition?.selectClubId, null, "no select");
  const tournament = competitionLinkedMatchNav({
    recordingClubId: "c1",
    managedClubIds: ["c1"],
    competitionId: "t-1",
    kind: "TOURNAMENT",
  });
  const tourneyNav = matchFinalizedNotificationNav(
    "MATCH_FINALIZED",
    { competitionId: "t-1", kind: "TOURNAMENT" },
    "PLAYER"
  );
  assert.equal(tournament?.href, tourneyNav?.href, "tournament dest");
  assert.equal(tournament?.href, "/tournaments/t-1", "tournaments");
  const casual = competitionLinkedMatchNav({ recordingClubId: "c1", managedClubIds: ["c1"] });
  assert.equal(casual?.href, "/club/c1", "club fallback");
  if (competition?.href === "/match" || tournament?.href === "/match" || casual?.href === "/match") {
    throw new Error("played VIEW ne doit pas envoyer vers /match");
  }
  if ((competition?.href ?? "").includes("match-sheet") || (tournament?.href ?? "").includes("match-sheet")) {
    throw new Error("played VIEW ne doit pas envoyer vers /match-sheet");
  }
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

test("TOURNAMENT_ROUND_SCHEDULED — type, label FR, href /tournaments/[id] jamais /notifications", () => {
  assert.true(isNotificationType("TOURNAMENT_ROUND_SCHEDULED"), "known type");
  assert.equal(NOTIFICATION_TYPE_LABELS.TOURNAMENT_ROUND_SCHEDULED, "Tour programmé", "label");
  assert.equal(notificationTitle("TOURNAMENT_ROUND_SCHEDULED", "x"), "Tour programmé", "title");
  assert.equal(
    notificationHref("TOURNAMENT_ROUND_SCHEDULED", { competitionId: "t-1", kind: "TOURNAMENT", round: 1 }),
    "/tournaments/t-1",
    "href"
  );
  assert.equal(notificationHref("TOURNAMENT_ROUND_SCHEDULED", {}), "/tournaments", "href empty");
  assert.equal(notificationHref("TOURNAMENT_ROUND_SCHEDULED", { competitionId: "" }), "/tournaments", "empty id");
  assert.false(
    notificationHref("TOURNAMENT_ROUND_SCHEDULED", { competitionId: "t-1", kind: "TOURNAMENT", round: 1 }).includes(
      "/notifications"
    ),
    "not dump"
  );
  assert.equal(
    tournamentRoundScheduledHref({ competitionId: "t-1", kind: "TOURNAMENT", round: 2 }),
    "/tournaments/t-1",
    "helper"
  );
  assert.equal(tournamentRoundScheduledHref({}), "/tournaments", "helper empty");
  assert.equal(
    inAppNotificationHref(
      "TOURNAMENT_ROUND_SCHEDULED",
      { competitionId: "t-1", kind: "TOURNAMENT", round: 1 },
      "PLAYER"
    ),
    "/tournaments/t-1",
    "in-app player"
  );
  assert.equal(
    inAppNotificationHref("TOURNAMENT_ROUND_SCHEDULED", { competitionId: "t-1", kind: "TOURNAMENT" }, "CLUB"),
    "/tournaments/t-1",
    "in-app club"
  );
  assert.equal(
    inAppNotificationHref("TOURNAMENT_ROUND_SCHEDULED", {}, "PLAYER"),
    "/tournaments",
    "in-app sans id ≠ /notifications"
  );
  const nav = tournamentRoundScheduledNotificationNav(
    "TOURNAMENT_ROUND_SCHEDULED",
    { competitionId: "t-1", kind: "TOURNAMENT", round: 1 },
    "PLAYER"
  );
  assert.equal(nav?.href, "/tournaments/t-1", "nav href");
  assert.equal(nav?.requireClubMode, false, "tournament stack sans forcer Club");
  assert.equal(nav?.selectClubId, null, "pas de club dans data");
  assert.equal(tournamentRoundScheduledNotificationNav("MATCH_FINALIZED", { competitionId: "t-1" }, "CLUB"), null, "not this type");
  const copy = tournamentRoundScheduledCopy({ tournamentName: "  Coupe du jeudi  ", round: 2 });
  assert.equal(copy.type, "TOURNAMENT_ROUND_SCHEDULED", "copy type");
  assert.equal(copy.title, "Tour programmé", "copy title");
  assert.equal(copy.body, "Le tour 2 de Coupe du jeudi est programmé.", "copy body");
  assert.equal(
    tournamentRoundScheduledCopy({ tournamentName: "   ", round: 1 }).body,
    "Le tour 1 de ce tournoi est programmé.",
    "copy fallback name"
  );
  const payload = tournamentRoundScheduledNotificationData({ competitionId: "t-1", round: 1 });
  assert.equal(payload.competitionId, "t-1", "data id");
  assert.equal(payload.kind, "TOURNAMENT", "data kind");
  assert.equal(payload.round, 1, "data round");
});

test("tournamentRoundScheduledRecipientIds — OWNER/MANAGER des paires, skip actor, pas MEMBER", () => {
  assert.equal(tournamentRoundScheduledClubIds([{ clubAId: "a", clubBId: "b" }, { clubAId: "a", clubBId: "c" }]).sort().join(","), "a,b,c", "unique clubs");
  const ids = tournamentRoundScheduledRecipientIds({
    actorId: "creator",
    clubMembers: [
      { userId: "creator", role: "OWNER" },
      { userId: "manager", role: "MANAGER" },
      { userId: "member", role: "MEMBER" },
      { userId: "owner-b", role: "OWNER" },
      { userId: "manager", role: "MANAGER" },
      { userId: "", role: "OWNER" },
    ],
  }).sort();
  assert.equal(ids.join(","), "manager,owner-b", "union minus actor/member/dup");
  assert.equal(
    tournamentRoundScheduledRecipientIds({
      actorId: "creator",
      clubMembers: [{ userId: "creator", role: "OWNER" }],
    }).join(","),
    "",
    "actor only"
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

test("signalements / blocs : FK PostgREST réelles, pas *_id_fkey inventé", () => {
  const src = readFileSync(`${process.cwd()}/lib/hooks/useSafety.ts`, "utf8");
  assert.true(src.includes("users!user_reports_reported_fkey"), "reports fkey");
  assert.true(src.includes("users!user_blocks_blocked_fkey"), "blocks fkey");
  assert.false(src.includes("user_reports_reported_id_fkey"), "pas reported_id_fkey");
  assert.false(src.includes("user_blocks_blocked_id_fkey"), "pas blocked_id_fkey");
  assert.true(src.includes('.from("user_reports")'), "reports query");
});

test("retirer de la feuille sans Bloquer ; check-in ne swallow pas", () => {
  const profile = readFileSync(`${process.cwd()}/components/profile/ProfileContent.tsx`, "utf8");
  assert.true(profile.includes("Retirer de la feuille"), "cta");
  assert.true(profile.includes("useClearSlotAssignment"), "mutates slots");
  assert.true(profile.includes("Bloquer"), "block stays");
  const checkin = readFileSync(`${process.cwd()}/components/club/MatchCheckinPanel.tsx`, "utf8");
  assert.true(checkin.includes("CHECKIN_NEEDS_LIVE_COPY"), "toast if no session");
  assert.true(checkin.includes("launch.mutate"), "calls Edge");
  assert.true(checkin.includes("onError"), "surfaces Edge error");
  const depart = readFileSync(`${process.cwd()}/components/club/MyDepartureStatusCard.tsx`, "utf8");
  assert.true(depart.includes("Confirmer"), "in-card confirm");
  assert.true(depart.includes("requestDeparture.mutate"), "mutates");
  assert.false(depart.includes("Alert.alert"), "not Alert-only");
});

test("0 match : Quitter le club immédiat, jamais OWNER, pas no_match_played", () => {
  const depart = readFileSync(`${process.cwd()}/components/club/MyDepartureStatusCard.tsx`, "utf8");
  const home = readFileSync(`${process.cwd()}/components/club/ClubHome.tsx`, "utf8");
  const hook = readFileSync(`${process.cwd()}/lib/hooks/useDepartures.ts`, "utf8");
  const edge = readFileSync(`${process.cwd()}/supabase/functions/request-departure/index.ts`, "utf8");
  const sql = readFileSync(`${process.cwd()}/supabase/migrations/0031_request_departure_zero_matches.sql`, "utf8");
  assert.true(depart.includes("Quitter le club"), "cta");
  assert.true(depart.includes("Tu n'as pas encore joué. Tu quittes tout de suite."), "zero copy");
  assert.true(depart.includes("leftImmediately"), "reads immediate flag");
  assert.true(depart.includes("Tu as quitté le club."), "immediate toast");
  assert.false(depart.includes("Tu dois avoir joué au moins 1 match"), "no gate copy");
  assert.true(home.includes("role !== \"OWNER\""), "owner never sees card");
  assert.true(hook.includes('queryKey: ["my-memberships"]'), "invalidate memberships");
  assert.true(hook.includes("leftImmediately"), "typed flag");
  assert.true(edge.includes("leftImmediately"), "edge returns flag");
  assert.true(edge.includes("ACCEPTED_NOW"), "skip 3 min push");
  assert.true(edge.includes("no_match_played"), "old DB mapping kept");
  assert.true(sql.includes("ACCEPTED_NOW"), "historize now");
  assert.true(sql.includes("initiated_by, requested_at, responded_at"), "player now");
  assert.true(sql.includes("release_club_member"), "reuses 0012 helper");
  assert.false(sql.includes("raise exception 'no_match_played'"), "no trap");
  assert.true(sql.includes("owner_cannot_request_departure"), "owner still blocked");
  assert.true(sql.includes("grant execute on function public.request_departure(uuid, uuid) to service_role"), "service_role only");
});

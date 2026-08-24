/**
 * Tests de lib/social.ts — labels chat, filtre block DM / membres de groupe.
 * Sans réseau. Lancer : npx tsx scripts/test-social.ts
 */
import {
  BLOCKED_DM_COPY,
  canStartDirectMessage,
  conversationListLabel,
  filterVisibleConversations,
  filterVisibleGroupMembers,
  getDirectConversationPeer,
  isDirectPeerBlocked,
} from "../lib/social";
import type { ConversationRow, GroupMemberRow, UserRow } from "../lib/types";

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

function user(id: string, username: string): UserRow {
  return {
    id,
    username,
    platform: "PS",
    main_position: "ST",
    secondary_positions: [],
    play_style: "ATTACKING",
    languages: ["FR"],
    availability: {},
    reliability_score: 50,
    verified_stats: null,
    ea_club_linked: null,
    ea_identity_kind: "NONE",
    plan: "FREE",
    current_streak: 0,
    best_streak: 0,
    badges: [],
    applications_today: 0,
    applications_reset_at: "2026-01-01T00:00:00.000Z",
    push_token: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function direct(id: string, selfId: string, peer: UserRow): ConversationRow {
  return {
    id,
    type: "DIRECT",
    club_id: null,
    group_id: null,
    created_by: selfId,
    created_at: "2026-01-01T00:00:00.000Z",
    members: [
      { id: "m1", conversation_id: id, user_id: selfId, role: "MEMBER", joined_at: "2026-01-01T00:00:00.000Z" },
      { id: "m2", conversation_id: id, user_id: peer.id, role: "MEMBER", joined_at: "2026-01-01T00:00:00.000Z", user: peer },
    ],
  };
}

console.log("lib/social.ts");

test("getDirectConversationPeer ignore self et les GROUP", () => {
  const peer = user("b", "Striker27");
  const dm = direct("c1", "a", peer);
  assert.equal(getDirectConversationPeer(dm, "a")?.username, "Striker27", "peer");
  assert.equal(getDirectConversationPeer({ ...dm, type: "GROUP" }, "a"), null, "group");
});

test("conversationListLabel — DIRECT / GROUP / CLUB, pas de présence inventée", () => {
  const peer = user("b", "Striker27");
  assert.equal(conversationListLabel(direct("c1", "a", peer), "a"), "Striker27", "dm");
  assert.equal(
    conversationListLabel(
      { id: "g", type: "GROUP", club_id: null, group_id: "g1", created_by: "a", created_at: "" },
      "a"
    ),
    "Groupe",
    "group"
  );
  assert.equal(
    conversationListLabel(
      { id: "cl", type: "CLUB", club_id: "club1", group_id: null, created_by: "a", created_at: "" },
      "a"
    ),
    "Club Pro Clubs",
    "club"
  );
});

test("filtre DM bloqués ; GROUP reste visible", () => {
  const peer = user("b", "Striker27");
  const other = user("c", "Cam27");
  const blockedDm = direct("c1", "me", peer);
  const openDm = direct("c2", "me", other);
  const group: ConversationRow = {
    id: "g1",
    type: "GROUP",
    club_id: null,
    group_id: "grp",
    created_by: "me",
    created_at: "",
  };
  assert.true(isDirectPeerBlocked(blockedDm, "me", ["b"]), "blocked");
  assert.false(isDirectPeerBlocked(openDm, "me", ["b"]), "open");
  assert.false(isDirectPeerBlocked(group, "me", ["b"]), "group not hidden");
  const visible = filterVisibleConversations([blockedDm, openDm, group], "me", new Set(["b"]));
  assert.equal(visible.map((c) => c.id).join(","), "c2,g1", "ids");
});

test("membres de groupe : block masque l'autre, pas soi", () => {
  const members: GroupMemberRow[] = [
    { id: "1", group_id: "g", user_id: "me", role: "OWNER", joined_at: "" },
    { id: "2", group_id: "g", user_id: "blocked", role: "MEMBER", joined_at: "" },
    { id: "3", group_id: "g", user_id: "ok", role: "MEMBER", joined_at: "" },
  ];
  const visible = filterVisibleGroupMembers(members, ["blocked"]);
  assert.equal(visible.map((m) => m.user_id).join(","), "me,ok", "ids");
});

test("canStartDirectMessage refuse self et blocked ; copy honnête non vide", () => {
  assert.false(canStartDirectMessage("me", "me", []), "self");
  assert.false(canStartDirectMessage("me", "x", ["x"]), "blocked");
  assert.true(canStartDirectMessage("me", "x", ["y"]), "ok");
  assert.true(BLOCKED_DM_COPY.includes("blocage"), "copy");
});

console.log(`\n${passed} tests OK`);

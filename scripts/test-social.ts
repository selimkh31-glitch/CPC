/**
 * Tests de lib/social.ts — labels chat, filtre block DM / membres de groupe.
 * Sans réseau. Lancer : npx tsx scripts/test-social.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import {
  BLOCKED_DM_COPY,
  CLUB_CONVERSATION_COPY,
  canOpenClubConversation,
  canStartDirectMessage,
  clubConversationSqlIssues,
  clubRoleToConversationRole,
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
      { id: "m1", conversation_id: id, user_id: selfId, role: "MEMBER", joined_at: "2026-01-01T00:00:00.000Z", last_read_at: null },
      { id: "m2", conversation_id: id, user_id: peer.id, role: "MEMBER", joined_at: "2026-01-01T00:00:00.000Z", last_read_at: null, user: peer },
    ],
  };
}

function groupConversation(group?: ConversationRow["group"]): ConversationRow {
  return {
    id: "g",
    type: "GROUP",
    club_id: null,
    group_id: "g1",
    created_by: "a",
    created_at: "",
    group,
  };
}

console.log("lib/social.ts");

test("getDirectConversationPeer ignore self et les GROUP", () => {
  const peer = user("b", "Striker27");
  const dm = direct("c1", "a", peer);
  assert.equal(getDirectConversationPeer(dm, "a")?.username, "Striker27", "peer");
  assert.equal(getDirectConversationPeer({ ...dm, type: "GROUP" }, "a"), null, "group");
});

test("conversationListLabel — DIRECT / GROUP hydraté / CLUB inchangé", () => {
  const peer = user("b", "Striker27");
  assert.equal(conversationListLabel(direct("c1", "a", peer), "a"), "Striker27", "dm");
  assert.equal(
    conversationListLabel(groupConversation({ id: "g1", name: "Les habitués" }), "a"),
    "Les habitués",
    "real group"
  );
  assert.equal(
    conversationListLabel(groupConversation({ id: "g1", name: "  After hours  " }), "a"),
    "After hours",
    "trimmed"
  );
  assert.equal(conversationListLabel(groupConversation(), "a"), "Groupe", "missing");
  assert.equal(conversationListLabel(groupConversation(null), "a"), "Groupe", "null embed");
  assert.equal(
    conversationListLabel(groupConversation({ id: "g1", name: "" }), "a"),
    "Groupe",
    "empty"
  );
  assert.equal(
    conversationListLabel(groupConversation({ id: "g1", name: "   " }), "a"),
    "Groupe",
    "whitespace"
  );
  const withMembers: ConversationRow = {
    ...groupConversation({ id: "g1", name: "Les habitués" }),
    members: [
      {
        id: "m1",
        conversation_id: "g",
        user_id: "a",
        role: "OWNER",
        joined_at: "",
        last_read_at: null,
        user: user("a", "Alice27"),
      },
      {
        id: "m2",
        conversation_id: "g",
        user_id: "b",
        role: "MEMBER",
        joined_at: "",
        last_read_at: null,
        user: peer,
      },
    ],
  };
  assert.equal(conversationListLabel(withMembers, "a"), "Les habitués", "not member usernames");
  assert.equal(
    conversationListLabel(
      { id: "cl", type: "CLUB", club_id: "club1", group_id: null, created_by: "a", created_at: "" },
      "a"
    ),
    "Club Pro Clubs",
    "club"
  );
});

test("useConversations / useConversation hydratent groups(id,name)", () => {
  const chat = readFileSync(`${process.cwd()}/lib/hooks/useChat.ts`, "utf8");
  const social = readFileSync(`${process.cwd()}/lib/social.ts`, "utf8");
  const list = readFileSync(`${process.cwd()}/app/conversations.tsx`, "utf8");
  const thread = readFileSync(`${process.cwd()}/app/conversation/[id].tsx`, "utf8");
  assert.true(chat.includes("groups(id,name)"), "hydrate join");
  assert.true(chat.includes("CONVERSATION_SELECT"), "shared select");
  assert.true(chat.includes("useConversations"), "list hook");
  assert.true(chat.includes("useConversation"), "thread hook");
  assert.false(chat.includes("club:clubs"), "no club join this tree");
  assert.true(social.includes("honestGroupConversationName"), "honest group name");
  assert.false(social.includes('"Groupe Pro Clubs"'), "no fake group fallback");
  assert.true(list.includes("conversationListLabel"), "list helper");
  assert.true(thread.includes("conversationListLabel"), "header helper");
});

test("filtre DM bloqués ; GROUP et CLUB restent visibles", () => {
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
  const club: ConversationRow = {
    id: "cl1",
    type: "CLUB",
    club_id: "club1",
    group_id: null,
    created_by: "me",
    created_at: "",
  };
  assert.true(isDirectPeerBlocked(blockedDm, "me", ["b"]), "blocked");
  assert.false(isDirectPeerBlocked(openDm, "me", ["b"]), "open");
  assert.false(isDirectPeerBlocked(group, "me", ["b"]), "group not hidden");
  assert.false(isDirectPeerBlocked(club, "me", ["b"]), "club not hidden");
  const visible = filterVisibleConversations([blockedDm, openDm, group, club], "me", new Set(["b"]));
  assert.equal(visible.map((c) => c.id).join(","), "c2,g1,cl1", "ids");
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

test("canOpenClubConversation — OWNER/MANAGER/MEMBER, pas un tiers", () => {
  assert.true(canOpenClubConversation("OWNER"), "owner");
  assert.true(canOpenClubConversation("MANAGER"), "manager");
  assert.true(canOpenClubConversation("MEMBER"), "member");
  assert.false(canOpenClubConversation(null), "null");
  assert.false(canOpenClubConversation(undefined), "undef");
  assert.equal(clubRoleToConversationRole("OWNER"), "OWNER", "owner role");
  assert.equal(clubRoleToConversationRole("MANAGER"), "ADMIN", "manager→admin");
  assert.equal(clubRoleToConversationRole("MEMBER"), "MEMBER", "member role");
  assert.true(CLUB_CONVERSATION_COPY.includes("club"), "copy fr");
});

test("SQL 0028 : get-or-create CLUB, pas de 2e moteur / pas d'INSERT client", () => {
  const valid = `
    create or replace function public.start_club_conversation(p_actor_id uuid, p_club_id uuid)
    type = 'CLUB'
    grant execute on function public.start_club_conversation(uuid, uuid) to service_role
    create or replace function public.sync_club_conversation_membership()
    on_club_member_conversation_sync
    club_role_to_conversation_role
  `;
  assert.equal(clubConversationSqlIssues(valid).join(" | "), "", "contrat 0028");
  const secondEngine = `${valid}\ncreate table public.club_messages (id uuid);`;
  assert.true(clubConversationSqlIssues(secondEngine).some((i) => i.startsWith("interdit:")), "no 2e moteur");
  assert.true(clubConversationSqlIssues("create table public.foo ()").length > 0, "sql incomplet");
});

console.log(`\n${passed} tests OK`);

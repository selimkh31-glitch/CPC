/**
 * Social (chat + groupes) — helpers purs d'affichage / filtrage block.
 * Aucun I/O : RLS, Edge start-direct-conversation / start-club-conversation /
 * create-group et le realtime messages restent la source de vérité.
 */
import type { ClubRole, ConversationRole, ConversationRow, GroupMemberRow, MessageRow, UserRow } from "@/lib/types";

/** Copy honnête : un blocage (les deux sens) interdit le DM, sans le cacher. */
export const BLOCKED_DM_COPY = "Tu ne peux pas envoyer de message à ce joueur (blocage).";

/** Entrée Club tab — conversation unique du club, pas un second chat.
 *  Fallback de titre seulement si le nom de club est vide / placeholder. */
export const CLUB_CONVERSATION_COPY = "Conversation du club";

/** Copy chat (tu, courte). Pas de jargon, pas de receipts / replies. */
export const CHAT_UX_COPY = {
  composerPlaceholder: "Message",
  send: "Envoyer",
  listEmptyTitle: "Personne n'a écrit.",
  listEmptySubtitle: "Ouvre un profil. Les groupes et le club arrivent ici.",
  threadEmptyTitle: "À toi d'écrire.",
  deleted: "Message supprimé",
  newGroup: "Nouveau groupe",
  groupName: "Nom",
  groupNamePlaceholder: "Les habitués du jeudi",
  whoIsIn: "Qui est dedans",
  write: "Écrire",
  join: "Rejoindre",
  kindGroup: "Groupe",
  kindClub: "Club",
} as const;

const CLUB_ROLES_CAN_OPEN = new Set<ClubRole>(["OWNER", "MANAGER", "MEMBER"]);

/** OWNER / MANAGER / MEMBER du club — pas un tiers. */
export function canOpenClubConversation(role: ClubRole | null | undefined): boolean {
  return Boolean(role && CLUB_ROLES_CAN_OPEN.has(role));
}

/** Miroir SQL `club_role_to_conversation_role` (0028). */
export function clubRoleToConversationRole(role: ClubRole): ConversationRole {
  if (role === "OWNER") return "OWNER";
  if (role === "MANAGER") return "ADMIN";
  return "MEMBER";
}

const REQUIRED_CLUB_CONVERSATION_SQL = [
  "create or replace function public.start_club_conversation",
  "type = 'CLUB'",
  "grant execute on function public.start_club_conversation",
  "to service_role",
  "create or replace function public.sync_club_conversation_membership",
  "on_club_member_conversation_sync",
  "club_role_to_conversation_role",
] as const;

const FORBIDDEN_CLUB_CONVERSATION_SQL = [
  "create table public.club_messages",
  "create table if not exists public.club_chats",
  "alter type \"conversationtype\" add value",
  "create policy \"conversations_insert",
] as const;

/** Contrat 0028 : get-or-create CLUB, pas un 2e moteur / pas d'INSERT client. */
export function clubConversationSqlIssues(sql: string): string[] {
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");
  const issues: string[] = [];
  for (const fragment of REQUIRED_CLUB_CONVERSATION_SQL) {
    if (!normalized.includes(fragment.toLowerCase())) {
      issues.push(`manque: ${fragment}`);
    }
  }
  for (const fragment of FORBIDDEN_CLUB_CONVERSATION_SQL) {
    if (normalized.includes(fragment.toLowerCase())) {
      issues.push(`interdit: ${fragment}`);
    }
  }
  return issues;
}

/** L'autre participant d'une conversation DIRECT (ou null si non applicable). */
export function getDirectConversationPeer(conversation: ConversationRow, selfUserId: string): UserRow | null {
  if (conversation.type !== "DIRECT") return null;
  const other = (conversation.members ?? []).find((m) => m.user_id !== selfUserId);
  return other?.user ?? null;
}

/** Nom de groupe affichable : trim, jamais un placeholder inventé. Vide → null. */
function honestGroupConversationName(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed ? trimmed : null;
}

/**
 * Nom de club affichable : trim, refuse « Club Pro Clubs » / « Club ».
 * Vide / placeholder → null (fallback `CLUB_CONVERSATION_COPY`).
 */
function honestClubConversationName(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed === "Club Pro Clubs" || trimmed === "Club") return null;
  return trimmed;
}

export function conversationListLabel(conversation: ConversationRow, selfUserId: string): string {
  if (conversation.type === "DIRECT") {
    return getDirectConversationPeer(conversation, selfUserId)?.username ?? "Joueur";
  }
  if (conversation.type === "GROUP") {
    return honestGroupConversationName(conversation.group?.name) ?? "Groupe";
  }
  if (conversation.type === "CLUB") {
    return honestClubConversationName(conversation.club?.name) ?? CLUB_CONVERSATION_COPY;
  }
  return "Conversation";
}

/** Distinctif d'en-tête seulement — pas un 2e chat. DIRECT = le nom suffit. */
export function conversationKindLabel(type: ConversationRow["type"]): string | null {
  if (type === "GROUP") return CHAT_UX_COPY.kindGroup;
  if (type === "CLUB") return CHAT_UX_COPY.kindClub;
  return null;
}

/** Aperçu liste : corps réel, ou « Message supprimé ». Jamais un placeholder inventé. */
export function conversationMessagePreview(
  message: Pick<MessageRow, "body" | "deleted_at"> | null | undefined
): string | null {
  if (!message) return null;
  if (message.deleted_at) return CHAT_UX_COPY.deleted;
  const text = message.body.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

/** Non-lu = dernier message plus récent que `last_read_at` du self. Pas un receipt. */
export function conversationIsUnread(input: {
  selfUserId: string;
  members?: ConversationRow["members"];
  lastMessageAt?: string | null;
}): boolean {
  if (!input.lastMessageAt) return false;
  const lastRead = input.members?.find((m) => m.user_id === input.selfUserId)?.last_read_at ?? null;
  if (!lastRead) return true;
  const messageMs = new Date(input.lastMessageAt).getTime();
  const readMs = new Date(lastRead).getTime();
  if (!Number.isFinite(messageMs) || !Number.isFinite(readMs)) return false;
  return messageMs > readMs;
}

export function isDirectPeerBlocked(
  conversation: ConversationRow,
  selfUserId: string,
  blockedIds: Iterable<string>
): boolean {
  if (conversation.type !== "DIRECT") return false;
  const peer = getDirectConversationPeer(conversation, selfUserId);
  if (!peer) return false;
  const set = blockedIds instanceof Set ? blockedIds : new Set(blockedIds);
  return set.has(peer.id);
}

export function filterVisibleConversations(
  conversations: readonly ConversationRow[],
  selfUserId: string,
  blockedIds: Iterable<string>
): ConversationRow[] {
  const set = blockedIds instanceof Set ? blockedIds : new Set(blockedIds);
  return conversations.filter((c) => !isDirectPeerBlocked(c, selfUserId, set));
}

export function filterVisibleGroupMembers(
  members: readonly GroupMemberRow[],
  blockedIds: Iterable<string>
): GroupMemberRow[] {
  const set = blockedIds instanceof Set ? blockedIds : new Set(blockedIds);
  return members.filter((m) => !set.has(m.user_id));
}

export function canStartDirectMessage(
  selfUserId: string | null | undefined,
  otherUserId: string | null | undefined,
  blockedIds: Iterable<string> | null | undefined
): boolean {
  if (!selfUserId || !otherUserId || selfUserId === otherUserId) return false;
  const set = blockedIds instanceof Set ? blockedIds : new Set(blockedIds ?? []);
  return !set.has(otherUserId);
}

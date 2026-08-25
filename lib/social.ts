/**
 * Social (chat + groupes) — helpers purs d'affichage / filtrage block.
 * Aucun I/O : RLS, Edge start-direct-conversation / start-club-conversation /
 * create-group et le realtime messages restent la source de vérité.
 */
import type { ClubRole, ConversationRole, ConversationRow, GroupMemberRow, UserRow } from "@/lib/types";
import { tournamentClubDisplayName } from "@/lib/tournaments";

/** Copy honnête : un blocage (les deux sens) interdit le DM, sans le cacher. */
export const BLOCKED_DM_COPY = "Tu ne peux pas envoyer de message à ce joueur (blocage).";

/** Entrée Club tab — conversation unique du club, pas un second chat. */
export const CLUB_CONVERSATION_COPY = "Conversation du club";

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

/**
 * Titre liste / header : nom réel hydraté pour CLUB, sinon copy générique.
 * Jamais « Club Pro Clubs » / « Club ».
 */
export function conversationDisplayName(conversation: ConversationRow, selfUserId: string): string {
  if (conversation.type === "DIRECT") {
    return getDirectConversationPeer(conversation, selfUserId)?.username ?? "Joueur Pro Clubs";
  }
  if (conversation.type === "GROUP") return "Groupe";
  if (conversation.type === "CLUB") {
    return tournamentClubDisplayName(conversation.club?.name) ?? CLUB_CONVERSATION_COPY;
  }
  return "Conversation";
}

/** Alias — même helper pour la liste et le fil. */
export const conversationListLabel = conversationDisplayName;

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

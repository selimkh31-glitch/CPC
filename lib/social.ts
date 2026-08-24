/**
 * Social (chat + groupes) — helpers purs d'affichage / filtrage block.
 * Aucun I/O : RLS, Edge start-direct-conversation / create-group et le
 * realtime messages restent la source de vérité.
 */
import type { ConversationRow, GroupMemberRow, UserRow } from "@/lib/types";

/** Copy honnête : un blocage (les deux sens) interdit le DM, sans le cacher. */
export const BLOCKED_DM_COPY = "Tu ne peux pas envoyer de message à ce joueur (blocage).";

/** L'autre participant d'une conversation DIRECT (ou null si non applicable). */
export function getDirectConversationPeer(conversation: ConversationRow, selfUserId: string): UserRow | null {
  if (conversation.type !== "DIRECT") return null;
  const other = (conversation.members ?? []).find((m) => m.user_id !== selfUserId);
  return other?.user ?? null;
}

export function conversationListLabel(conversation: ConversationRow, selfUserId: string): string {
  if (conversation.type === "DIRECT") {
    return getDirectConversationPeer(conversation, selfUserId)?.username ?? "Joueur Pro Clubs";
  }
  if (conversation.type === "GROUP") return "Groupe";
  if (conversation.type === "CLUB") return "Club Pro Clubs";
  return "Conversation";
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

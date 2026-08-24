import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";
import { usersAreBlocked } from "../_shared/blocked.ts";
import { notifyUser } from "../_shared/notify.ts";
import {
  messageReceivedCopy,
  otherConversationParticipantIds,
  shouldNotifyMessageReceived,
} from "../_shared/safety.ts";

/**
 * Après un INSERT message (send path client + RLS), crée la notification
 * in-app MESSAGE_RECEIVED pour l'autre participant DIRECT via RPC
 * create_notification + notifyUser (push Expo en plus, jamais à la place).
 * Skip GROUP/CLUB, skip paire bloquée, skip self. Non-bloquant pour l'envoi.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let messageId: string;
  try {
    const body = await req.json();
    messageId = requireUuid(body.messageId, "messageId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: message, error: messageError } = await admin
    .from("messages")
    .select("id, conversation_id, sender_id, deleted_at")
    .eq("id", messageId)
    .maybeSingle();

  if (messageError) {
    console.error("[notify-message-received] message:", messageError.message);
    return jsonResponse({ error: "Impossible de charger le message." }, 500);
  }
  if (!message) return jsonResponse({ error: "Message introuvable." }, 404);
  if (message.sender_id !== user.id) {
    return jsonResponse({ error: "Non autorisé" }, 403);
  }

  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .select("id, type")
    .eq("id", message.conversation_id)
    .maybeSingle();

  if (conversationError) {
    console.error("[notify-message-received] conversation:", conversationError.message);
    return jsonResponse({ error: "Impossible de charger la conversation." }, 500);
  }
  if (!conversation) return jsonResponse({ error: "Conversation introuvable." }, 404);
  if (conversation.type !== "DIRECT") {
    return jsonResponse({ notified: 0, skipped: "not_direct" });
  }

  const { data: memberships, error: membersError } = await admin
    .from("conversation_members")
    .select("user_id, user:users(id, username, push_token)")
    .eq("conversation_id", message.conversation_id);

  if (membersError) {
    console.error("[notify-message-received] members:", membersError.message);
    return jsonResponse({ error: "Impossible de charger les participants." }, 500);
  }

  const memberRows = memberships ?? [];
  const recipientIds = otherConversationParticipantIds(
    memberRows.map((row) => row.user_id),
    message.sender_id
  );

  const senderRow = memberRows.find((row) => row.user_id === message.sender_id);
  const senderUsername =
    (senderRow?.user as { username?: string } | null)?.username ??
    (await loadUsername(admin, message.sender_id)) ??
    "Un joueur";
  const copy = messageReceivedCopy(senderUsername);

  let notified = 0;
  for (const recipientId of recipientIds) {
    const block = await usersAreBlocked(admin, message.sender_id, recipientId);
    if (block.error) {
      console.warn("[notify-message-received] users_are_blocked:", block.error);
      continue;
    }
    if (
      !shouldNotifyMessageReceived({
        conversationType: conversation.type,
        senderId: message.sender_id,
        recipientId,
        blocked: block.blocked,
        deleted: Boolean(message.deleted_at),
      })
    ) {
      continue;
    }

    const recipient = memberRows.find((row) => row.user_id === recipientId);
    await notifyUser(admin, {
      userId: recipientId,
      type: copy.type,
      title: copy.title,
      body: copy.body,
      data: { conversationId: message.conversation_id, messageId: message.id },
      pushToken: (recipient?.user as { push_token?: string | null } | null)?.push_token,
    });
    notified += 1;
  }

  return jsonResponse({ notified });
});

async function loadUsername(
  admin: { from: Function },
  userId: string
): Promise<string | null> {
  const { data } = await admin.from("users").select("username").eq("id", userId).maybeSingle();
  return typeof data?.username === "string" ? data.username : null;
}

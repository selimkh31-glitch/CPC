import { sendPushNotification } from "./push.ts";

export interface NotifyUserInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  pushToken?: string | null;
}

/**
 * Notification in-app (RPC create_notification, service_role) + push Expo
 * existant. Non-bloquant : un échec n'annule jamais apply/invite/respond.
 */
export async function notifyUser(admin: { rpc: Function }, input: NotifyUserInput): Promise<void> {
  try {
    const { error } = await admin.rpc("create_notification", {
      p_user_id: input.userId,
      p_type: input.type,
      p_title: input.title,
      p_body: input.body,
      p_data: input.data ?? {},
    });
    if (error) console.warn("[notify] create_notification:", error.message);
  } catch (err) {
    console.warn("[notify] create_notification exception:", err);
  }

  await sendPushNotification(input.pushToken, input.title, input.body, {
    type: input.type,
    ...(input.data ?? {}),
  });
}

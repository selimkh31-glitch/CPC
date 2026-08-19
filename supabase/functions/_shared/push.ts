/** Envoi de push notifications via l'API Expo Push — utilisé par apply/respond-application. */
export async function sendPushNotification(
  pushToken: string | null | undefined,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  if (!pushToken || !pushToken.startsWith("ExponentPushToken")) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ to: pushToken, title, body, data, sound: "default" }),
    });
  } catch (err) {
    console.warn("[push] envoi échoué (non-bloquant):", err);
  }
}

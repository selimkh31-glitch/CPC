import { jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";

const PRO_EVENTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"]);
const FREE_EVENTS = new Set(["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"]);

/**
 * Webhook RevenueCat -> Supabase (section 6, paiement mobile). Synchronise
 * `users.plan` avec l'entitlement `pro` RevenueCat. Configure l'URL et le
 * secret dans RevenueCat > Project Settings > Integrations > Webhooks.
 * Voir README > "Brancher RevenueCat".
 *
 * Déployée avec `verify_jwt = false` (supabase/config.toml) : RevenueCat
 * n'envoie jamais de JWT Supabase, seulement ce secret partagé statique —
 * c'est le mécanisme d'auth webhook documenté par RevenueCat lui-même,
 * pas une lacune de sécurité de cette fonction.
 */
Deno.serve(async (req) => {
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const authHeader = req.headers.get("authorization");
  // Secret absent côté serveur -> toujours refuser, même face à un header
  // littéral "Bearer undefined".
  if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
    return jsonResponse({ error: "Non autorisé" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON invalide" }, 400);
  }

  const event = (body as { event?: Record<string, unknown> } | null)?.event;
  const eventType = typeof event?.type === "string" ? event.type : null;
  if (!event || !eventType) {
    return jsonResponse({ error: "Payload RevenueCat invalide (event.type manquant)" }, 400);
  }

  // `app_user_id` = notre users.id (Supabase), configuré côté app via
  // `Purchases.configure({ apiKey, appUserID: session.user.id })` — c'est
  // donc toujours censé être un uuid Supabase valide.
  let userId: string;
  try {
    userId = requireUuid(event.app_user_id, "event.app_user_id");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Payload RevenueCat invalide" }, 400);
  }

  // Événement dont on ne dérive aucun changement de plan (ex. TRANSFER,
  // NON_RENEWING_PURCHASE...) : accusé de réception sans écriture, idempotent.
  if (!PRO_EVENTS.has(eventType) && !FREE_EVENTS.has(eventType)) {
    return jsonResponse({ received: true, ignored: eventType });
  }

  const plan = PRO_EVENTS.has(eventType) ? "PRO" : "FREE";
  const admin = getAdminClient();

  try {
    const { error } = await admin.from("users").update({ plan }).eq("id", userId);
    if (error) throw error;
  } catch (err) {
    // 500 structuré (pas de crash non géré) : RevenueCat retente automatiquement
    // les webhooks en échec sur un statut non-2xx, c'est le comportement voulu ici.
    console.error("[revenuecat-webhook] échec de mise à jour du plan:", err);
    return jsonResponse({ error: "Erreur interne lors de la mise à jour du plan." }, 500);
  }

  return jsonResponse({ received: true, plan });
});

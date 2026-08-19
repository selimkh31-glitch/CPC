import { jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { sendPushNotification } from "../_shared/push.ts";

/**
 * Job planifié (Phase 5, section F) — cron Supabase (pg_cron -> pg_net, même
 * mécanisme que ea-sync/season-ranking), protégé par CRON_SECRET. Balaie les
 * demandes de départ PENDING dont expires_at est dépassé et applique le même
 * strike unifié qu'un refus explicite (apply_departure_strike) — 3e strike
 * cumulé (refus + timeout confondus) -> FORCE_EXIT automatique.
 *
 * Chaque demande expirée est traitée dans sa propre transaction (un appel RPC
 * par ligne) : l'échec d'une ne doit jamais bloquer le traitement des autres.
 */
Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) return jsonResponse({ error: "Non autorisé" }, 401);

  const admin = getAdminClient();

  const { data: expired, error: fetchError } = await admin
    .from("club_departures")
    .select("id")
    .eq("status", "PENDING")
    .lte("expires_at", new Date().toISOString());

  if (fetchError) return jsonResponse({ error: fetchError.message }, 500);
  if (!expired || expired.length === 0) return jsonResponse({ processed: 0 });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const row of expired) {
    const { data: departure, error } = await admin.rpc("apply_departure_strike", {
      p_departure_id: row.id,
      p_actor_id: null,
      p_reason: "EXPIRED",
    });

    if (error) {
      // departure_not_pending : traitée entretemps par un respond-departure
      // concurrent (course avec l'owner) — attendu, non-bloquant, pas une
      // vraie erreur du sweep.
      results.push({ id: row.id, ok: false, error: error.message });
      continue;
    }

    results.push({ id: row.id, ok: true });

    const { data: player } = await admin.from("users").select("push_token").eq("id", departure.user_id).maybeSingle();
    const [title, body] =
      departure.status === "FORCE_EXIT"
        ? ["Départ forcé 🔓", "3 refus/non-réponses cumulés : tu es automatiquement libéré."]
        : ["Demande de départ expirée ⏱️", "L'owner n'a pas répondu à temps. Tu peux refaire une demande."];
    await sendPushNotification(player?.push_token, title, body, { type: "departure_response", status: departure.status });

    const { data: managers } = await admin
      .from("club_members")
      .select("user:users(push_token)")
      .eq("club_id", departure.club_id)
      .in("role", ["OWNER", "MANAGER"]);
    for (const m of managers ?? []) {
      await sendPushNotification(
        (m as any).user?.push_token,
        departure.status === "FORCE_EXIT" ? "Force Exit déclenché" : "Demande de départ expirée",
        departure.status === "FORCE_EXIT"
          ? "Un joueur a été automatiquement libéré (3 strikes cumulés)."
          : "Une demande de départ a expiré faute de réponse sous 3 minutes.",
        { type: "departure_expired", status: departure.status }
      );
    }
  }

  return jsonResponse({ processed: results.filter((r) => r.ok).length, skipped: results.filter((r) => !r.ok).length, results });
});

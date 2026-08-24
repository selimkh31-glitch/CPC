import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireString, requireUuid, ValidationError } from "../_shared/validate.ts";
import { rejectIfBlocked } from "../_shared/blocked.ts";
import { notifyUser } from "../_shared/notify.ts";

/**
 * Club -> joueur (phase 4) : le owner/manager invite un joueur sur un slot
 * précis de sa feuille de match. Distinct d'`apply` (joueur -> club) — jamais
 * mélangés, voir Invitation vs Application dans le modèle.
 *
 * Note V1 : l'appartenance exacte de `slotId` à la formation courante du club
 * n'est pas revérifiée ici (lib/formations.ts est côté app, pas dupliqué
 * server-side pour rester source de vérité unique — voir accept_invitation()).
 * Un slotId invalide resterait sans effet visuel (n'apparaît sur aucun
 * terrain) ; la contrainte unique DB reste la garantie anti-double-attribution.
 *
 * Phase 5 (section D/19) — un joueur ne peut avoir qu'un seul membership
 * MEMBER/MANAGER actif (contrainte DB club_members_one_active_role_per_user).
 * S'il en a déjà un ailleurs :
 *   - en transition programmée (ACCEPTED_NEXT_MATCH) -> cette invitation
 *     devient une OFFRE DE TRANSITION (departure_request_id posé) ; elle ne
 *     sera acceptable que via respond-transition-invitation (PENDING ->
 *     RESERVED, jamais ACCEPTED direct — la finalisation attend le match
 *     libérateur, voir launch_match_checkin()).
 *   - sinon (pleinement engagé ailleurs) -> invitation refusée d'emblée.
 *   - déjà RESERVED par un club (transition_invitation_id non nul sur le
 *     départ) -> invitation refusée (player_already_reserved) : une
 *     transition n'est réservable qu'une seule fois, jamais deux offres
 *     concurrentes. Même garde reposée côté RPC accept_transition_invitation
 *     (défense en profondeur, le serveur ne fait jamais confiance à cette
 *     seule vérification côté Edge Function).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let clubId: string;
  let slotId: string;
  let userId: string;
  try {
    const body = await req.json();
    clubId = requireUuid(body.clubId, "clubId");
    slotId = requireString(body.slotId, "slotId", { min: 1, max: 20 });
    userId = requireUuid(body.userId, "userId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: membership } = await admin
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !["OWNER", "MANAGER"].includes(membership.role)) {
    return jsonResponse({ error: "Non autorisé" }, 403);
  }

  const blocked = await rejectIfBlocked(admin, user.id, userId);
  if (blocked) return blocked;

  const { data: club } = await admin.from("clubs").select("id, name, owner_id").eq("id", clubId).maybeSingle();
  if (!club) return jsonResponse({ error: "Club introuvable." }, 404);
  if (club.owner_id !== user.id) {
    const ownerBlocked = await rejectIfBlocked(admin, club.owner_id, userId);
    if (ownerBlocked) return ownerBlocked;
  }

  const { data: targetUser } = await admin.from("users").select("id, push_token").eq("id", userId).maybeSingle();
  if (!targetUser) return jsonResponse({ error: "Joueur introuvable." }, 404);

  const { data: targetMembership } = await admin
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (targetMembership) {
    return jsonResponse({ error: "Ce joueur est déjà membre du club." }, 409);
  }

  // Phase 5 — le joueur a-t-il déjà un membership MEMBER/MANAGER actif
  // ailleurs ? Si oui, cette invitation ne peut être qu'une offre de
  // transition (et seulement si son départ est déjà programmé après le
  // prochain match) — jamais une invitation normale.
  let departureRequestId: string | null = null;
  const { data: otherMembership } = await admin
    .from("club_members")
    .select("club_id, active_departure_request_id")
    .eq("user_id", userId)
    .in("role", ["MEMBER", "MANAGER"])
    .neq("club_id", clubId)
    .maybeSingle();

  if (otherMembership) {
    const { data: departure } = otherMembership.active_departure_request_id
      ? await admin
          .from("club_departures")
          .select("id, status, transition_invitation_id")
          .eq("id", otherMembership.active_departure_request_id)
          .maybeSingle()
      : { data: null };

    if (!departure || departure.status !== "ACCEPTED_NEXT_MATCH") {
      return jsonResponse({ error: "Ce joueur est déjà engagé avec un autre club." }, 409);
    }
    // Correctif faille RESERVED : une transition n'est réservable qu'une
    // seule fois. Si ce départ a déjà une invitation RESERVED (peu importe
    // laquelle), aucun autre club ne peut en proposer une nouvelle — sinon
    // deux clubs pourraient chacun croire avoir "gagné" le même joueur.
    if (departure.transition_invitation_id) {
      return jsonResponse({ error: "player_already_reserved" }, 409);
    }
    departureRequestId = departure.id;
  }

  const { data: existingSlot } = await admin
    .from("slot_assignments")
    .select("id")
    .eq("club_id", clubId)
    .eq("slot_id", slotId)
    .maybeSingle();
  if (existingSlot) {
    return jsonResponse({ error: "Ce poste vient d'être pris." }, 409);
  }

  // M3 — un joueur ne peut avoir qu'une seule invitation PENDING à la fois
  // dans CE club, quel que soit le slot visé : unique club_id+user_id+PENDING,
  // PAS club_id+slot_id+user_id+PENDING. Généralise (et remplace) l'ancienne
  // vérification scopée au seul slot, qui ne détectait pas le cas où le même
  // joueur avait déjà une invitation PENDING vers un AUTRE slot du même club
  // — l'insertion réussissait alors silencieusement pour la 2e invitation, et
  // c'est seulement à l'acceptation (accept_invitation, slot_assignments
  // unique [clubId,userId]) que l'échec survenait, tardivement et avec un
  // message trompeur. `status = "PENDING"` filtré explicitement : une
  // invitation ACCEPTED/DECLINED/CANCELLED/RESERVED n'est jamais concernée
  // par cette garde — et une invitation ACCEPTED a de toute façon déjà créé
  // le club_members correspondant, donc bloquée plus haut par la vérification
  // `targetMembership` avant même d'atteindre ce point. Un club différent
  // n'est jamais concerné (`club_id` filtré) — inchangé, régi séparément par
  // la vérification `otherMembership` ci-dessus.
  // Correctif faille .maybeSingle() (hotfix M3-2) : .maybeSingle() attend 0 ou
  // 1 ligne — au-delà, PostgREST renvoie data=null + error PGRST116 (voir
  // audit "INVITATIONS PENDING — AUDIT GLOBAL DES DOUBLONS"). Si des lignes
  // PENDING historiques dupliquées subsistent pour un (club_id,user_id) déjà
  // rencontré, cette garde devenait alors silencieusement inopérante — data
  // étant null, le `if` ne se déclenchait plus jamais. `.select().limit(1)`
  // renvoie toujours un tableau, jamais d'erreur de cardinalité, quel que
  // soit le nombre réel de lignes PENDING existantes (0, 1 ou 12) — et
  // `error` est désormais explicitement vérifié plutôt qu'ignoré.
  const { data: existingInvites, error: existingInviteError } = await admin
    .from("invitations")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("status", "PENDING")
    .limit(1);
  if (existingInviteError) {
    return jsonResponse({ error: existingInviteError.message }, 500);
  }
  if (existingInvites && existingInvites.length > 0) {
    return jsonResponse({ error: "Ce joueur a déjà une invitation en attente dans ce club." }, 409);
  }

  const { data: invitation, error } = await admin
    .from("invitations")
    .insert({
      club_id: clubId,
      slot_id: slotId,
      user_id: userId,
      invited_by: user.id,
      departure_request_id: departureRequestId,
    })
    .select()
    .single();

  if (error) {
    // Index unique partiel invitations_one_pending_transition_per_departure
    // (0010) : un autre club a déjà une offre de transition PENDING en cours
    // pour ce même départ programmé.
    if (error.message.includes("invitations_one_pending_transition_per_departure")) {
      return jsonResponse({ error: "Ce joueur a déjà une offre de transition en attente d'un autre club." }, 409);
    }
    if (error.message.includes("users_blocked")) {
      return jsonResponse({ error: "Tu ne peux pas interagir avec ce joueur." }, 403);
    }
    return jsonResponse({ error: error.message }, 500);
  }

  await notifyUser(admin, {
    userId,
    type: "INVITATION_RECEIVED",
    title: "Invitation reçue",
    body: `${club.name} t'invite sur un poste.`,
    data: { clubId, invitationId: invitation.id, slotId },
    pushToken: (targetUser as any).push_token,
  });

  return jsonResponse({ invitation });
});

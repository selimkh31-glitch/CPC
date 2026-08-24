import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";
import { rejectIfBlocked } from "../_shared/blocked.ts";
import { notifyUser } from "../_shared/notify.ts";

/**
 * Club -> joueur, invitation GÉNÉRALE (pas de slot/match visé) — miroir
 * d'`invite-to-slot` (inchangée, jamais touchée ici) sans la partie
 * slot/formation/slot_assignments. `slot_id = null` sur la ligne créée : le
 * modèle `invitations` distinguait déjà ce cas nativement dans
 * accept_invitation() (0007_match_sheet_rls.sql — slot_assignments sauté si
 * `slot_id is null`, club_members créé dans tous les cas), seule cette
 * fonction de création manquait. Aucune migration/RLS/RPC modifiée.
 *
 * Phase 5 (section D/19) — même garde d'engagement qu'`invite-to-slot` : un
 * joueur ne peut avoir qu'un seul membership MEMBER/MANAGER actif. S'il en a
 * déjà un ailleurs, cette invitation ne peut être qu'une offre de transition
 * (departure_request_id posé, acceptable uniquement via
 * respond-transition-invitation) si son départ est déjà programmé après le
 * prochain match, sinon refusée d'emblée — logique identique, non
 * slot-spécifique.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let clubId: string;
  let userId: string;
  try {
    const body = await req.json();
    clubId = requireUuid(body.clubId, "clubId");
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
  if (!targetUser) {
    return jsonResponse({ error: "Joueur introuvable." }, 404);
  }

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
  // prochain match) — jamais une invitation normale. Logique identique à
  // invite-to-slot, non spécifique au slot.
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
    // Une transition n'est réservable qu'une seule fois (même garde
    // qu'invite-to-slot) — voir aussi accept_transition_invitation.
    if (departure.transition_invitation_id) {
      return jsonResponse({ error: "player_already_reserved" }, 409);
    }
    departureRequestId = departure.id;
  }

  // Pré-check applicatif (message clair, cas normal) — l'index unique partiel
  // invitations_one_pending_per_club_user (0015) reste le garde-fou final
  // contre une course concurrente entre deux appels simultanés (voir gestion
  // de `error` après l'INSERT ci-dessous).
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
      slot_id: null,
      user_id: userId,
      invited_by: user.id,
      departure_request_id: departureRequestId,
    })
    .select()
    .single();

  if (error) {
    // Course concurrente ayant dépassé le pré-check ci-dessus : l'index
    // unique partiel invitations_one_pending_per_club_user rejette le doublon
    // (Postgres 23505) — même message métier que le pré-check, jamais une
    // erreur 500 générique pour ce cas normal.
    if (error.code === "23505" || error.message.includes("invitations_one_pending_per_club_user")) {
      return jsonResponse({ error: "Ce joueur a déjà une invitation en attente dans ce club." }, 409);
    }
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
    body: `${club.name} t'invite à rejoindre le club.`,
    data: { clubId, invitationId: invitation.id },
    pushToken: (targetUser as any).push_token,
  });

  return jsonResponse({ invitation });
});

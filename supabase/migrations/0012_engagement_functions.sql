-- ==============================================================================
-- ClubPro Connect — Phase 5, Étape 2 : fonctions SQL SECURITY DEFINER pour
-- l'engagement/départs/check-in. À exécuter APRÈS 0011. Toutes ces fonctions
-- ne sont appelables que par service_role (EXECUTE révoqué pour anon/
-- authenticated) — appelées exclusivement depuis les Edge Functions
-- correspondantes (Phase 2), jamais en RPC direct côté client.
-- ==============================================================================

-- ------------------------------------------------------------------
-- Helper interne : libère un membre d'un club (supprime slot_assignments PUIS
-- club_members). Ces deux tables ne sont PAS liées par cascade (voir
-- schema.prisma, commentaire explicite sur SlotAssignment) : chaque chemin de
-- libération doit les traiter ensemble, jamais compter sur une suppression
-- automatique. Réutilisé par respond_departure(NOW), apply_departure_strike
-- (FORCE_EXIT), release_member_by_manager, et launch_match_checkin.
-- ------------------------------------------------------------------
create or replace function public.release_club_member(p_club_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.slot_assignments where club_id = p_club_id and user_id = p_user_id;
  delete from public.club_members where club_id = p_club_id and user_id = p_user_id;
end;
$$;

-- ------------------------------------------------------------------
-- Demande de départ (section B/A du brief validé). Verrouille la ligne
-- club_members pour éviter qu'un double-appel concurrent crée deux demandes
-- PENDING pour le même membership. Exceptions nommées, traduites en messages
-- utilisateur par l'Edge Function appelante :
--   not_a_member, owner_cannot_request_departure, no_match_played,
--   departure_already_active
-- ------------------------------------------------------------------
create or replace function public.request_departure(p_club_id uuid, p_user_id uuid)
returns public.club_departures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.club_members;
  v_dep public.club_departures;
begin
  select * into v_member from public.club_members
    where club_id = p_club_id and user_id = p_user_id for update;

  if v_member is null then
    raise exception 'not_a_member';
  end if;
  if v_member.role = 'OWNER' then
    raise exception 'owner_cannot_request_departure';
  end if;
  if v_member.matches_played_count < 1 then
    raise exception 'no_match_played';
  end if;
  if v_member.active_departure_request_id is not null then
    raise exception 'departure_already_active';
  end if;

  insert into public.club_departures (club_id, user_id, status, initiated_by, requested_at, expires_at)
    values (p_club_id, p_user_id, 'PENDING', 'PLAYER', now(), now() + interval '3 minutes')
    returning * into v_dep;

  update public.club_members set active_departure_request_id = v_dep.id where id = v_member.id;

  return v_dep;
end;
$$;

-- ------------------------------------------------------------------
-- Strike unifié (REFUS + TIMEOUT = même compteur, décision produit validée) —
-- partagé par respond_departure(REFUSE) et resolve-expired-departures
-- (EXPIRED). Verrouille la demande ET le membership. Au 3ᵉ strike cumulé :
-- FORCE_EXIT, libération immédiate, AUCUNE sanction fonctionnelle (juste
-- l'historique). p_actor_id est NULL pour un déclenchement automatique (cron).
-- ------------------------------------------------------------------
create or replace function public.apply_departure_strike(p_departure_id uuid, p_actor_id uuid, p_reason text)
returns public.club_departures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep public.club_departures;
  v_member public.club_members;
  v_new_strikes int;
begin
  if p_reason not in ('REFUSED', 'EXPIRED') then
    raise exception 'invalid_reason';
  end if;

  select * into v_dep from public.club_departures where id = p_departure_id for update;
  if v_dep is null then
    raise exception 'departure_not_found';
  end if;
  if v_dep.status <> 'PENDING' then
    raise exception 'departure_not_pending';
  end if;

  select * into v_member from public.club_members
    where club_id = v_dep.club_id and user_id = v_dep.user_id for update;
  if v_member is null then
    raise exception 'member_not_found';
  end if;

  v_new_strikes := v_member.strike_count + 1;
  update public.club_members set strike_count = v_new_strikes where id = v_member.id;

  if v_new_strikes >= 3 then
    update public.club_departures
      set status = 'FORCE_EXIT', responded_at = now(), responded_by = p_actor_id
      where id = p_departure_id
      returning * into v_dep;
    perform public.release_club_member(v_dep.club_id, v_dep.user_id);
  else
    update public.club_departures
      set status = p_reason::public."DepartureStatus", responded_at = now(), responded_by = p_actor_id
      where id = p_departure_id
      returning * into v_dep;
    update public.club_members set active_departure_request_id = null where id = v_member.id;
  end if;

  return v_dep;
end;
$$;

-- ------------------------------------------------------------------
-- Réponse owner/manager aux 3 choix (section B). Point d'entrée unique.
-- Verrouille la demande, revérifie rôle + statut PENDING + non-expirée (garde
-- contre la course avec le sweep cron, même principe que accept_application/
-- accept_invitation). REFUSE délègue à apply_departure_strike (compteur
-- unifié). Exceptions : departure_not_found, not_authorized,
-- departure_not_pending, departure_expired, invalid_decision.
-- ------------------------------------------------------------------
create or replace function public.respond_departure(p_departure_id uuid, p_actor_id uuid, p_decision text)
returns public.club_departures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep public.club_departures;
  v_is_manager boolean;
begin
  if p_decision not in ('NOW', 'NEXT_MATCH', 'REFUSE') then
    raise exception 'invalid_decision';
  end if;

  select * into v_dep from public.club_departures where id = p_departure_id for update;
  if v_dep is null then
    raise exception 'departure_not_found';
  end if;

  select exists(
    select 1 from public.club_members m
    where m.club_id = v_dep.club_id and m.user_id = p_actor_id and m.role in ('OWNER', 'MANAGER')
  ) into v_is_manager;
  if not v_is_manager then
    raise exception 'not_authorized';
  end if;

  if v_dep.status <> 'PENDING' then
    raise exception 'departure_not_pending';
  end if;
  if v_dep.expires_at is not null and v_dep.expires_at <= now() then
    raise exception 'departure_expired';
  end if;

  if p_decision = 'REFUSE' then
    return public.apply_departure_strike(p_departure_id, p_actor_id, 'REFUSED');
  end if;

  if p_decision = 'NOW' then
    update public.club_departures
      set status = 'ACCEPTED_NOW', responded_at = now(), responded_by = p_actor_id
      where id = p_departure_id
      returning * into v_dep;
    perform public.release_club_member(v_dep.club_id, v_dep.user_id);
  else -- NEXT_MATCH : le membership reste inchangé, active_departure_request_id
       -- continue de pointer vers cette même ligne, désormais ACCEPTED_NEXT_MATCH.
    update public.club_departures
      set status = 'ACCEPTED_NEXT_MATCH', responded_at = now(), responded_by = p_actor_id
      where id = p_departure_id
      returning * into v_dep;
  end if;

  return v_dep;
end;
$$;

-- ------------------------------------------------------------------
-- Libération par owner/manager (section H). Ne peut jamais cibler un OWNER
-- (un club ne peut pas exister sans owner — succession hors périmètre).
-- Historise directement en état terminal OWNER_RELEASED (pas de phase
-- PENDING, contrairement à une demande joueur).
-- ------------------------------------------------------------------
create or replace function public.release_member_by_manager(p_club_id uuid, p_target_user_id uuid, p_actor_id uuid)
returns public.club_departures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_manager boolean;
  v_member public.club_members;
  v_dep public.club_departures;
begin
  select exists(
    select 1 from public.club_members m
    where m.club_id = p_club_id and m.user_id = p_actor_id and m.role in ('OWNER', 'MANAGER')
  ) into v_is_manager;
  if not v_is_manager then
    raise exception 'not_authorized';
  end if;

  select * into v_member from public.club_members
    where club_id = p_club_id and user_id = p_target_user_id for update;
  if v_member is null then
    raise exception 'member_not_found';
  end if;
  if v_member.role = 'OWNER' then
    raise exception 'cannot_release_owner';
  end if;

  perform public.release_club_member(p_club_id, p_target_user_id);

  insert into public.club_departures (club_id, user_id, status, initiated_by, requested_at, responded_at, responded_by)
    values (p_club_id, p_target_user_id, 'OWNER_RELEASED', 'OWNER', now(), now(), p_actor_id)
    returning * into v_dep;

  return v_dep;
end;
$$;

-- ------------------------------------------------------------------
-- Acceptation d'une invitation de TRANSITION (departure_request_id non nul,
-- posé par invite-to-slot). PENDING -> RESERVED, jamais ACCEPTED : le joueur
-- n'intègre club_members/slot_assignments du nouveau club qu'à la
-- finalisation par launch_match_checkin (match libérateur validé chez
-- l'ancien club) — jamais avant, sinon double appartenance transitoire.
--
-- Anti-double-revendication déjà garantie par l'index unique partiel
-- invitations_one_pending_transition_per_departure (0010) : à tout instant,
-- au plus une invitation PENDING peut exister pour une même demande de
-- départ — un second club ne peut donc jamais créer d'offre concurrente
-- pendant que celle-ci existe (échec net à l'INSERT côté invite-to-slot).
-- Rien à nettoyer ici.
-- ------------------------------------------------------------------
create or replace function public.accept_transition_invitation(p_invitation_id uuid, p_actor_id uuid)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
  v_dep public.club_departures;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if v_inv is null then
    raise exception 'invitation_not_found';
  end if;
  if v_inv.user_id <> p_actor_id then
    raise exception 'not_authorized';
  end if;
  if v_inv.status <> 'PENDING' then
    raise exception 'invitation_not_pending';
  end if;
  if v_inv.departure_request_id is null then
    raise exception 'not_a_transition_invitation';
  end if;

  select * into v_dep from public.club_departures where id = v_inv.departure_request_id for update;
  if v_dep is null or v_dep.status <> 'ACCEPTED_NEXT_MATCH' then
    raise exception 'departure_not_transitionable';
  end if;

  update public.invitations set status = 'RESERVED' where id = p_invitation_id returning * into v_inv;

  update public.club_departures
    set transition_invitation_id = v_inv.id, transition_target_club_id = v_inv.club_id
    where id = v_dep.id;

  return v_inv;
end;
$$;

-- ------------------------------------------------------------------
-- Check-in / lancement du match (section J-M, la fonction la plus complexe).
-- Doit obligatoirement référencer une club_session live du club (pas de
-- check-in "hors session", décision produit validée). Titulaires =
-- slot_assignments actuel (source de vérité, aucun tableau parallèle).
--
-- Pour chaque titulaire :
--   - absent -> match_participations ABSENT, slot_assignments supprimé
--     (le slot redevient un slot vide ordinaire, traitable par
--     player-search/invite-to-slot existants SANS aucune modification —
--     recrutement d'urgence, section L)
--   - présent -> match_participations PRESENT, matches_played_count += 1
--
-- Puis résolution des départs ACCEPTED_NEXT_MATCH dont le titulaire vient
-- d'être marqué présent (règle stricte section M : absent à SON match
-- libérateur ne compte pas, il reste en transition) : libération + éventuelle
-- finalisation d'une transition RESERVED vers le nouveau club, atomiquement.
-- ------------------------------------------------------------------
create or replace function public.launch_match_checkin(
  p_club_id uuid,
  p_session_id uuid,
  p_actor_id uuid,
  p_absent_user_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_manager boolean;
  v_session public.club_sessions;
  v_formation text;
  v_checkin public.match_checkins;
  v_slot record;
  v_departure record;
  v_invitation public.invitations;
  v_present_users uuid[] := '{}';
  v_absent_users uuid[] := '{}';
  v_finalized jsonb := '[]'::jsonb;
begin
  select exists(
    select 1 from public.club_members m
    where m.club_id = p_club_id and m.user_id = p_actor_id and m.role in ('OWNER', 'MANAGER')
  ) into v_is_manager;
  if not v_is_manager then
    raise exception 'not_authorized';
  end if;

  select * into v_session from public.club_sessions where id = p_session_id for update;
  if v_session is null or v_session.club_id <> p_club_id then
    raise exception 'session_not_found';
  end if;
  if not v_session.is_live then
    raise exception 'session_not_live';
  end if;

  select formation into v_formation from public.clubs where id = p_club_id;
  if v_formation is null then
    raise exception 'no_formation_set';
  end if;

  insert into public.match_checkins (club_id, session_id, formation_id, launched_at, launched_by)
    values (p_club_id, p_session_id, v_formation, now(), p_actor_id)
    returning * into v_checkin;

  for v_slot in select * from public.slot_assignments where club_id = p_club_id loop
    if v_slot.user_id = any(p_absent_user_ids) then
      insert into public.match_participations (match_checkin_id, user_id, club_id, slot_id, status)
        values (v_checkin.id, v_slot.user_id, p_club_id, v_slot.slot_id, 'ABSENT');
      delete from public.slot_assignments where id = v_slot.id;
      v_absent_users := array_append(v_absent_users, v_slot.user_id);
    else
      insert into public.match_participations (match_checkin_id, user_id, club_id, slot_id, status)
        values (v_checkin.id, v_slot.user_id, p_club_id, v_slot.slot_id, 'PRESENT');
      update public.club_members set matches_played_count = matches_played_count + 1
        where club_id = p_club_id and user_id = v_slot.user_id;
      v_present_users := array_append(v_present_users, v_slot.user_id);
    end if;
  end loop;

  for v_departure in
    select d.* from public.club_departures d
    join public.club_members m
      on m.club_id = d.club_id and m.user_id = d.user_id and m.active_departure_request_id = d.id
    where d.club_id = p_club_id
      and d.user_id = any(v_present_users)
      and d.status = 'ACCEPTED_NEXT_MATCH'
      and d.release_match_checkin_id is null
    for update of d
  loop
    update public.club_departures set release_match_checkin_id = v_checkin.id where id = v_departure.id;

    select * into v_invitation from public.invitations
      where departure_request_id = v_departure.id and status = 'RESERVED'
      limit 1;

    perform public.release_club_member(v_departure.club_id, v_departure.user_id);

    if v_invitation.id is not null then
      insert into public.club_members (club_id, user_id, role)
        values (v_invitation.club_id, v_invitation.user_id, 'MEMBER')
        on conflict (club_id, user_id) do nothing;

      if v_invitation.slot_id is not null then
        begin
          insert into public.slot_assignments (club_id, slot_id, user_id)
            values (v_invitation.club_id, v_invitation.slot_id, v_invitation.user_id);
        exception when unique_violation then
          -- Slot pris entretemps côté nouveau club : le joueur reste membre
          -- (banc), non bloquant pour la finalisation de son départ.
          null;
        end;
      end if;

      update public.invitations set status = 'ACCEPTED' where id = v_invitation.id;
      update public.club_departures
        set transition_invitation_id = v_invitation.id, transition_target_club_id = v_invitation.club_id
        where id = v_departure.id;
    end if;

    v_finalized := v_finalized || jsonb_build_object(
      'userId', v_departure.user_id,
      'departureId', v_departure.id,
      'transitioned', v_invitation.id is not null,
      'targetClubId', v_invitation.club_id
    );
  end loop;

  return jsonb_build_object(
    'checkin', to_jsonb(v_checkin),
    'presentUserIds', to_jsonb(v_present_users),
    'absentUserIds', to_jsonb(v_absent_users),
    'finalizedDepartures', v_finalized
  );
end;
$$;

-- ------------------------------------------------------------------
-- accept_application / accept_invitation — CREATE OR REPLACE additif : gère
-- désormais proprement la nouvelle contrainte multi-appartenance
-- (club_members_one_active_role_per_user, 0010). Comportement pré-existant
-- STRICTEMENT conservé (verrouillage, anti-surbooking, assignation de slot) ;
-- seule l'insertion club_members est enrobée pour transformer une violation
-- de la nouvelle contrainte en exception nommée already_has_active_club
-- plutôt qu'une erreur Postgres brute. Le on conflict (club_id, user_id)
-- existant continue de gérer l'idempotence de ré-acceptation à l'identique.
-- ------------------------------------------------------------------
create or replace function public.accept_application(p_application_id uuid, p_actor_id uuid)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_session public.club_sessions;
  v_is_manager boolean;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if v_app is null then
    raise exception 'application_not_found';
  end if;

  select exists(
    select 1 from public.club_members m
    where m.club_id = v_app.club_id and m.user_id = p_actor_id and m.role in ('OWNER', 'MANAGER')
  ) into v_is_manager;
  if not v_is_manager then
    raise exception 'not_authorized';
  end if;

  if v_app.status <> 'PENDING' then
    raise exception 'application_not_pending';
  end if;

  select * into v_session from public.club_sessions where id = v_app.session_id for update;
  if v_session is null or not (v_app.position = any(v_session.needed_positions)) then
    raise exception 'position_unavailable';
  end if;

  update public.club_sessions
    set needed_positions = array_remove(needed_positions, v_app.position)
    where id = v_session.id;

  if v_app.slot_id is not null then
    if exists (
      select 1 from public.slot_assignments s
      where s.club_id = v_app.club_id and s.slot_id = v_app.slot_id
    ) then
      raise exception 'slot_unavailable';
    end if;

    begin
      insert into public.slot_assignments (club_id, slot_id, user_id)
        values (v_app.club_id, v_app.slot_id, v_app.user_id);
    exception when unique_violation then
      raise exception 'slot_unavailable';
    end;
  end if;

  update public.applications
    set status = 'ACCEPTED'
    where id = p_application_id
    returning * into v_app;

  begin
    insert into public.club_members (club_id, user_id, role)
      values (v_app.club_id, v_app.user_id, 'MEMBER')
      on conflict (club_id, user_id) do nothing;
  exception when unique_violation then
    raise exception 'already_has_active_club';
  end;

  return v_app;
end;
$$;

revoke execute on function public.accept_application(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_application(uuid, uuid) to service_role;

create or replace function public.accept_invitation(p_invitation_id uuid, p_actor_id uuid)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if v_inv is null then
    raise exception 'invitation_not_found';
  end if;

  if v_inv.user_id <> p_actor_id then
    raise exception 'not_authorized';
  end if;

  if v_inv.status <> 'PENDING' then
    raise exception 'invitation_not_pending';
  end if;

  if v_inv.slot_id is not null then
    if exists (
      select 1 from public.slot_assignments s
      where s.club_id = v_inv.club_id and s.slot_id = v_inv.slot_id
    ) then
      raise exception 'slot_unavailable';
    end if;

    begin
      insert into public.slot_assignments (club_id, slot_id, user_id)
        values (v_inv.club_id, v_inv.slot_id, v_inv.user_id);
    exception when unique_violation then
      raise exception 'slot_unavailable';
    end;
  end if;

  begin
    insert into public.club_members (club_id, user_id, role)
      values (v_inv.club_id, v_inv.user_id, 'MEMBER')
      on conflict (club_id, user_id) do nothing;
  exception when unique_violation then
    raise exception 'already_has_active_club';
  end;

  update public.invitations
    set status = 'ACCEPTED'
    where id = p_invitation_id
    returning * into v_inv;

  return v_inv;
end;
$$;

revoke execute on function public.accept_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_invitation(uuid, uuid) to service_role;

-- ------------------------------------------------------------------
-- Grants — toutes les nouvelles fonctions : service_role uniquement, jamais
-- anon/authenticated (appelées exclusivement depuis les Edge Functions).
-- ------------------------------------------------------------------
revoke execute on function public.release_club_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_club_member(uuid, uuid) to service_role;

revoke execute on function public.request_departure(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_departure(uuid, uuid) to service_role;

revoke execute on function public.apply_departure_strike(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_departure_strike(uuid, uuid, text) to service_role;

revoke execute on function public.respond_departure(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.respond_departure(uuid, uuid, text) to service_role;

revoke execute on function public.release_member_by_manager(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_member_by_manager(uuid, uuid, uuid) to service_role;

revoke execute on function public.accept_transition_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_transition_invitation(uuid, uuid) to service_role;

revoke execute on function public.launch_match_checkin(uuid, uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.launch_match_checkin(uuid, uuid, uuid, uuid[]) to service_role;

-- ==============================================================================
-- Rejoin after leave: leftover club_members / slots / PENDING applications
-- must not block a new candidature. Membership ≠ XI slot.
--
-- 1) release_club_member also withdraws PENDING applications and cancels
--    PENDING invitations for that pair (historique conservé, jamais DELETE).
-- 2) accept_application / accept_invitation upsert the same-club membership
--    instead of ON CONFLICT DO NOTHING, drop stale slots, then assign only
--    if the candidature/invitation actually targeted a slot.
-- ==============================================================================

create or replace function public.release_club_member(p_club_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.slot_assignments where club_id = p_club_id and user_id = p_user_id;

  update public.applications
    set status = 'WITHDRAWN'
    where club_id = p_club_id
      and user_id = p_user_id
      and status = 'PENDING';

  update public.invitations
    set status = 'CANCELLED'
    where club_id = p_club_id
      and user_id = p_user_id
      and status = 'PENDING';

  delete from public.club_members where club_id = p_club_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.release_club_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_club_member(uuid, uuid) to service_role;

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

  -- Stale XI from a previous stay must not keep the player on the pitch.
  delete from public.slot_assignments
    where club_id = v_app.club_id and user_id = v_app.user_id;

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
      on conflict (club_id, user_id) do update
        set role = excluded.role,
            joined_at = now()
        where public.club_members.role <> 'OWNER';
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

  delete from public.slot_assignments
    where club_id = v_inv.club_id and user_id = v_inv.user_id;

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
      on conflict (club_id, user_id) do update
        set role = excluded.role,
            joined_at = now()
        where public.club_members.role <> 'OWNER';
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

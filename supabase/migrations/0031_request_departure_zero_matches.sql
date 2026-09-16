-- ==============================================================================
-- 0 match joué : le joueur MEMBER/MANAGER peut quitter tout de suite.
-- request_departure ne lève plus no_match_played. OWNER inchangé.
-- Grant toujours service_role only. Réutilise release_club_member (0012).
-- ==============================================================================

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
  if v_member.active_departure_request_id is not null then
    raise exception 'departure_already_active';
  end if;

  if v_member.matches_played_count < 1 then
    insert into public.club_departures (
      club_id, user_id, status, initiated_by, requested_at, responded_at
    )
      values (p_club_id, p_user_id, 'ACCEPTED_NOW', 'PLAYER', now(), now())
      returning * into v_dep;
    perform public.release_club_member(p_club_id, p_user_id);
    return v_dep;
  end if;

  insert into public.club_departures (club_id, user_id, status, initiated_by, requested_at, expires_at)
    values (p_club_id, p_user_id, 'PENDING', 'PLAYER', now(), now() + interval '3 minutes')
    returning * into v_dep;

  update public.club_members set active_departure_request_id = v_dep.id where id = v_member.id;

  return v_dep;
end;
$$;

revoke execute on function public.request_departure(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_departure(uuid, uuid) to service_role;

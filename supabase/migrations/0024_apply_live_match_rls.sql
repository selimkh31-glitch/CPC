-- ==============================================================================
-- P1 — durcir la boucle LIVE + candidature (défense en profondeur).
-- À appliquer APRÈS 0023_expire_live_janitor.sql.
--
-- 1) LIVE club exige au moins un poste recherché (sinon le feed montre un
--    LIVE auquel on ne peut pas postuler).
-- 2) INSERT applications : trigger = LIVE actif + expiry + poste ∈ besoin
--    + poste joué par le joueur + même plateforme que l'owner.
--    Couvre le INSERT client (RLS applications_insert_self) comme l'Edge.
-- 3) RLS manager : plus d'ACCEPT client (doit passer par accept_application).
--    Refus / annulation manuelle seulement (DECLINED / CANCELLED) depuis PENDING.
-- ==============================================================================

-- ------------------------------------------------------------------
-- 1) LIVE ⇒ besoin non vide
-- ------------------------------------------------------------------
update public.club_sessions
  set is_live = false
  where is_live
    and cardinality(coalesce(needed_positions, '{}')) = 0;

alter table public.club_sessions
  drop constraint if exists club_sessions_live_requires_need;
alter table public.club_sessions
  add constraint club_sessions_live_requires_need
  check (not is_live or cardinality(needed_positions) > 0);

-- ------------------------------------------------------------------
-- 2) Trigger matching à l'INSERT candidature
-- ------------------------------------------------------------------
create or replace function public.applications_enforce_live_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live boolean;
  v_expires timestamp(3);
  v_needed "Position"[];
  v_owner_platform text;
  v_main "Position";
  v_secondary "Position"[];
  v_player_platform text;
begin
  select s.is_live, s.expires_at, s.needed_positions
    into v_live, v_expires, v_needed
    from public.club_sessions s
    where s.id = new.session_id;

  if not found then
    raise exception 'session_not_found';
  end if;

  if not v_live or v_expires is null or v_expires <= now() then
    raise exception 'session_not_live';
  end if;

  if v_needed is null or cardinality(v_needed) = 0 then
    raise exception 'session_no_need';
  end if;

  if new.position is null or not (new.position = any (v_needed)) then
    raise exception 'position_not_needed';
  end if;

  select u.main_position, u.secondary_positions, u.platform::text
    into v_main, v_secondary, v_player_platform
    from public.users u
    where u.id = new.user_id;

  if not found then
    raise exception 'player_not_found';
  end if;

  if new.position is distinct from v_main
     and not (new.position = any (coalesce(v_secondary, ARRAY[]::"Position"[]))) then
    raise exception 'position_not_played';
  end if;

  select ou.platform::text
    into v_owner_platform
    from public.clubs c
    join public.users ou on ou.id = c.owner_id
    where c.id = new.club_id;

  if v_owner_platform is null then
    raise exception 'platform_unknown';
  end if;
  if v_owner_platform is distinct from v_player_platform then
    raise exception 'platform_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_enforce_live_match on public.applications;
create trigger applications_enforce_live_match
  before insert on public.applications
  for each row
  execute function public.applications_enforce_live_match();

-- ------------------------------------------------------------------
-- 3) Manager : plus d'ACCEPT via UPDATE client (Edge/RPC seulement)
-- ------------------------------------------------------------------
drop policy if exists "applications_update_manager" on public.applications;
create policy "applications_update_manager" on public.applications
  for update to authenticated
  using (
    status = 'PENDING'
    and exists (
      select 1 from public.club_members m
      where m.club_id = applications.club_id
        and m.user_id = auth.uid()
        and m.role in ('OWNER', 'MANAGER')
    )
  )
  with check (
    status in ('DECLINED', 'CANCELLED')
    and exists (
      select 1 from public.club_members m
      where m.club_id = applications.club_id
        and m.user_id = auth.uid()
        and m.role in ('OWNER', 'MANAGER')
    )
  );

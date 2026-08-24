-- ==============================================================================
-- P1 — janitor LIVE + transitions candidatures/invitations.
-- À appliquer APRÈS 0022_recruitment_status_enums.sql.
--
-- 1) expire_stale_live_sessions() coupe les LIVE périmés ET passe les
--    candidatures PENDING de ces sessions en EXPIRED (idempotent).
-- 2) Trigger sur club_sessions : LIVE → OFFLINE
--    - TTL écoulé → applications EXPIRED
--    - coupe manuelle → applications CANCELLED
--    (invitations : pas de session_id — on ne les touche pas ici, un nouveau
--    LIVE du même club ne doit pas mass-cancel les invites MATCH).
-- 3) EXECUTE accordé à authenticated : ouvrir le Live Feed appelle le
--    janitor même si pg_cron / CRON_SECRET n'est pas câblé.
-- 4) pg_cron chaque minute SI l'extension est disponible (no-op sinon).
-- ==============================================================================

create or replace function public.expire_stale_live_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club integer := 0;
  v_player integer := 0;
begin
  update public.club_sessions
    set is_live = false
    where is_live
      and expires_at is not null
      and expires_at <= now();
  get diagnostics v_club = row_count;

  update public.player_sessions
    set is_live = false
    where is_live
      and expires_at is not null
      and expires_at <= now();
  get diagnostics v_player = row_count;

  -- Filet : PENDING orphelins sur une session déjà hors TTL.
  -- Scopé à session_id (jamais un club_id) : un nouveau LIVE du même club
  -- ne doit pas faire expirer des invitations fraîches.
  update public.applications
    set status = 'EXPIRED'
    where status = 'PENDING'
      and session_id in (
        select id from public.club_sessions
        where expires_at is not null and expires_at <= now()
      );

  return v_club + v_player;
end;
$$;

revoke execute on function public.expire_stale_live_sessions() from public, anon;
grant execute on function public.expire_stale_live_sessions() to authenticated;
grant execute on function public.expire_stale_live_sessions() to service_role;

-- ------------------------------------------------------------------
-- Trigger : LIVE OFF (manuel ou janitor) → CANCELLED vs EXPIRED
-- Le janitor pose déjà EXPIRED sur les apps des sessions qu'il éteint ;
-- le WHERE status = 'PENDING' rend le trigger idempotent (no-op ensuite).
-- ------------------------------------------------------------------
create or replace function public.on_club_session_live_off()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if old.is_live and not new.is_live then
    if new.expires_at is not null and new.expires_at <= now() then
      v_status := 'EXPIRED';
    else
      v_status := 'CANCELLED';
    end if;

    update public.applications
      set status = v_status::"ApplicationStatus"
      where session_id = new.id
        and status = 'PENDING';
  end if;
  return new;
end;
$$;

drop trigger if exists club_sessions_live_off_recruitment on public.club_sessions;
create trigger club_sessions_live_off_recruitment
  after update of is_live on public.club_sessions
  for each row
  when (old.is_live = true and new.is_live = false)
  execute function public.on_club_session_live_off();

-- ------------------------------------------------------------------
-- pg_cron : janitor SQL direct (pas d'HTTP, pas de CRON_SECRET).
-- Si l'extension n'est pas là, on documente l'invoke manuel — voir README.
-- ------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('expire-live-sessions-sql');
    perform cron.schedule(
      'expire-live-sessions-sql',
      '* * * * *',
      $cron$select public.expire_stale_live_sessions()$cron$
    );
  end if;
exception
  when undefined_function then
    null;
  when others then
    null;
end;
$$;

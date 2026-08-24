-- ==============================================================================
-- ClubPro Connect — P0 LIVE expiry (club + joueur) + idempotence candidatures.
-- Source appliquée au distant : ce fichier (Option B, supabase/migrations/).
-- DDL miroir dans prisma/migrations/20260824000000_live_expiry_player_live
-- (outillage Prisma uniquement — NE PAS double-appliquer via prisma migrate
-- deploy sur le projet distant déjà migré par ce fichier).
--
-- 1) club_sessions.expires_at — un LIVE club a un TTL, jamais infini.
-- 2) player_sessions — LIVE joueur (recrutement), 1 LIVE / user, TTL identique.
-- 3) applications : au plus une PENDING par (user_id, session_id).
-- 4) expire_stale_live_sessions() — cron / Edge expire-live-sessions.
-- ==============================================================================

-- ------------------------------------------------------------------
-- 1) TTL LIVE club
-- ------------------------------------------------------------------
alter table public.club_sessions
  add column if not exists expires_at timestamp(3);

-- Sessions actuellement LIVE : 2 h à partir de maintenant (pas d'infini
-- pour les lignes historiques). Les sessions déjà "oubliées" depuis plus
-- longtemps seront coupées par expire_stale_live_sessions() juste après
-- si on réduit, mais ici on leur donne un TTL frais pour ne pas vider le
-- feed d'un coup sans que l'owner le sache — le client + cron feront le
-- reste. Les lignes is_live = false restent expires_at NULL.
update public.club_sessions
  set expires_at = now() + interval '2 hours'
  where is_live and expires_at is null;

alter table public.club_sessions
  drop constraint if exists club_sessions_live_requires_expiry;
alter table public.club_sessions
  add constraint club_sessions_live_requires_expiry
  check (not is_live or expires_at is not null);

create index if not exists club_sessions_expires_at_idx
  on public.club_sessions (expires_at);

-- ------------------------------------------------------------------
-- 2) LIVE joueur
-- ------------------------------------------------------------------
create table if not exists public.player_sessions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  is_live boolean not null default false,
  note text,
  expires_at timestamp(3),
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,

  constraint player_sessions_pkey primary key (id),
  constraint player_sessions_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade on update cascade,
  constraint player_sessions_live_requires_expiry
    check (not is_live or expires_at is not null)
);

create index if not exists player_sessions_is_live_idx on public.player_sessions (is_live);
create index if not exists player_sessions_user_id_idx on public.player_sessions (user_id);
create index if not exists player_sessions_expires_at_idx on public.player_sessions (expires_at);

create unique index if not exists player_sessions_one_live_per_user
  on public.player_sessions (user_id)
  where is_live;

drop trigger if exists handle_player_sessions_updated_at on public.player_sessions;
create trigger handle_player_sessions_updated_at
  before update on public.player_sessions
  for each row execute function extensions.moddatetime(updated_at);

alter table public.player_sessions enable row level security;

drop policy if exists "player_sessions_select_authenticated" on public.player_sessions;
create policy "player_sessions_select_authenticated" on public.player_sessions
  for select to authenticated using (true);

drop policy if exists "player_sessions_insert_self" on public.player_sessions;
create policy "player_sessions_insert_self" on public.player_sessions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "player_sessions_update_self" on public.player_sessions;
create policy "player_sessions_update_self" on public.player_sessions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Default privileges (0006) couvrent normalement cette table ; grant
-- explicite par défense en profondeur (même doctrine que 0008).
grant select, insert, update on public.player_sessions to authenticated;
grant all on public.player_sessions to service_role;

-- ------------------------------------------------------------------
-- 3) Idempotence candidatures PENDING (symétrique de 0015 invitations)
-- ------------------------------------------------------------------
-- Dédupliquer d'éventuels PENDING déjà présents : on conserve le plus
-- ancien, les suivants passent WITHDRAWN (historique conservé, jamais DELETE).
with ranked as (
  select id,
    row_number() over (partition by user_id, session_id order by created_at asc, id asc) as rn
  from public.applications
  where status = 'PENDING'
)
update public.applications a
  set status = 'WITHDRAWN'
  from ranked r
  where a.id = r.id and r.rn > 1;

create unique index if not exists applications_one_pending_per_user_session
  on public.applications (user_id, session_id)
  where status = 'PENDING';

-- ------------------------------------------------------------------
-- 4) Expiration serveur (Edge expire-live-sessions, CRON_SECRET)
-- ------------------------------------------------------------------
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

  return v_club + v_player;
end;
$$;

revoke execute on function public.expire_stale_live_sessions() from public, anon, authenticated;
grant execute on function public.expire_stale_live_sessions() to service_role;

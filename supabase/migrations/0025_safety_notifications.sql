-- ==============================================================================
-- P1 — Safety (block/report) + notifications in-app + identité EA honnête.
-- À appliquer APRÈS 0024_apply_live_match_rls.sql.
-- Source distante : ce fichier (Option B). Miroir Prisma dans schema.prisma
-- uniquement — NE PAS double-appliquer via prisma migrate deploy.
--
-- 1) user_blocks / user_reports — écriture Edge (service_role), lecture RLS.
-- 2) notifications — insert via RPC create_notification (service_role) ;
--    le client ne peut que LIRE ses lignes et poser read_at.
-- 3) users.ea_identity_kind — NONE | USERNAME_EQUALITY (pas d'id joueur EA).
-- 4) Block réel : RPC users_are_blocked, triggers applications/invitations/
--    messages DIRECT, start_direct_conversation refuse la paire bloquée.
-- ==============================================================================

-- ------------------------------------------------------------------
-- 0) Identité EA — fondation sûre (pas de faux id joueur)
-- ------------------------------------------------------------------
alter table public.users
  add column if not exists ea_identity_kind text not null default 'NONE';

alter table public.users
  drop constraint if exists users_ea_identity_kind_check;
alter table public.users
  add constraint users_ea_identity_kind_check
  check (ea_identity_kind in ('NONE', 'USERNAME_EQUALITY'));

revoke select on public.users from authenticated;
grant select (
  id, username, platform, main_position, secondary_positions, play_style, languages,
  availability, reliability_score, verified_stats, ea_club_linked, ea_identity_kind, plan, current_streak,
  best_streak, badges, applications_today, applications_reset_at, created_at
) on public.users to authenticated;

-- ------------------------------------------------------------------
-- 1) Tables
-- ------------------------------------------------------------------
create table if not exists public.user_blocks (
  id uuid not null default gen_random_uuid(),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamp(3) not null default current_timestamp,

  constraint user_blocks_pkey primary key (id),
  constraint user_blocks_blocker_fkey foreign key (blocker_id) references public.users(id) on delete cascade,
  constraint user_blocks_blocked_fkey foreign key (blocked_id) references public.users(id) on delete cascade,
  constraint user_blocks_not_self check (blocker_id <> blocked_id),
  constraint user_blocks_pair_unique unique (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

create table if not exists public.user_reports (
  id uuid not null default gen_random_uuid(),
  reporter_id uuid not null,
  reported_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'OPEN',
  created_at timestamp(3) not null default current_timestamp,

  constraint user_reports_pkey primary key (id),
  constraint user_reports_reporter_fkey foreign key (reporter_id) references public.users(id) on delete cascade,
  constraint user_reports_reported_fkey foreign key (reported_id) references public.users(id) on delete cascade,
  constraint user_reports_not_self check (reporter_id <> reported_id),
  constraint user_reports_reason_check check (reason in ('HARASSMENT', 'CHEATING', 'FAKE_IDENTITY', 'SPAM', 'OTHER')),
  constraint user_reports_status_check check (status in ('OPEN', 'REVIEWED', 'DISMISSED'))
);

create unique index if not exists user_reports_one_open_per_pair
  on public.user_reports (reporter_id, reported_id)
  where status = 'OPEN';

create index if not exists user_reports_reported_status_idx
  on public.user_reports (reported_id, status);

create table if not exists public.notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamp(3),
  created_at timestamp(3) not null default current_timestamp,

  constraint notifications_pkey primary key (id),
  constraint notifications_user_fkey foreign key (user_id) references public.users(id) on delete cascade,
  constraint notifications_type_not_empty check (char_length(type) > 0),
  constraint notifications_title_not_empty check (char_length(title) > 0)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- Default privileges (0006) auraient donné INSERT/UPDATE/DELETE client.
revoke insert, update, delete on public.user_blocks from authenticated;
revoke insert, update, delete on public.user_reports from authenticated;
revoke insert, delete on public.notifications from authenticated;

grant select on public.user_blocks to authenticated;
grant select on public.user_reports to authenticated;
grant select on public.notifications to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

grant all privileges on public.user_blocks to service_role;
grant all privileges on public.user_reports to service_role;
grant all privileges on public.notifications to service_role;

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.notifications enable row level security;

drop policy if exists user_blocks_select_involved on public.user_blocks;
create policy user_blocks_select_involved on public.user_blocks
  for select to authenticated
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists user_reports_select_own on public.user_reports;
create policy user_reports_select_own on public.user_reports
  for select to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists notifications_update_read_own on public.notifications;
create policy notifications_update_read_own on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- 2) RPCs
-- ------------------------------------------------------------------
create or replace function public.users_are_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

revoke execute on function public.users_are_blocked(uuid, uuid) from public, anon;
grant execute on function public.users_are_blocked(uuid, uuid) to authenticated, service_role;

create or replace function public.my_blocked_user_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return '{}'::uuid[];
  end if;
  return coalesce((
    select array_agg(distinct other_id)
    from (
      select blocked_id as other_id from public.user_blocks where blocker_id = auth.uid()
      union
      select blocker_id as other_id from public.user_blocks where blocked_id = auth.uid()
    ) s
  ), '{}'::uuid[]);
end;
$$;

revoke execute on function public.my_blocked_user_ids() from public, anon;
grant execute on function public.my_blocked_user_ids() to authenticated, service_role;

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notifications;
begin
  if p_user_id is null or p_type is null or char_length(trim(p_type)) = 0 then
    raise exception 'notification_invalid';
  end if;
  insert into public.notifications (user_id, type, title, body, data)
    values (p_user_id, trim(p_type), trim(p_title), trim(p_body), coalesce(p_data, '{}'::jsonb))
    returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.create_notification(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_notification(uuid, text, text, text, jsonb) to service_role;

-- ------------------------------------------------------------------
-- 3) start_direct_conversation — refuse une paire bloquée
-- ------------------------------------------------------------------
create or replace function public.start_direct_conversation(p_actor_id uuid, p_other_user_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_existing_id uuid;
begin
  if p_actor_id = p_other_user_id then
    raise exception 'cannot_message_self';
  end if;

  if not exists (select 1 from public.users where id = p_other_user_id) then
    raise exception 'user_not_found';
  end if;

  if public.users_are_blocked(p_actor_id, p_other_user_id) then
    raise exception 'users_blocked';
  end if;

  select c.id into v_existing_id
  from public.conversations c
  where c.type = 'DIRECT'
    and exists (select 1 from public.conversation_members m1 where m1.conversation_id = c.id and m1.user_id = p_actor_id)
    and exists (select 1 from public.conversation_members m2 where m2.conversation_id = c.id and m2.user_id = p_other_user_id)
  limit 1;

  if v_existing_id is not null then
    select * into v_conversation from public.conversations where id = v_existing_id;
    return v_conversation;
  end if;

  insert into public.conversations (type, created_by)
    values ('DIRECT', p_actor_id)
    returning * into v_conversation;

  insert into public.conversation_members (conversation_id, user_id, role)
    values (v_conversation.id, p_actor_id, 'MEMBER'), (v_conversation.id, p_other_user_id, 'MEMBER');

  return v_conversation;
end;
$$;

revoke execute on function public.start_direct_conversation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_direct_conversation(uuid, uuid) to service_role;

-- ------------------------------------------------------------------
-- 4) Triggers — block effectif hors Edge
-- ------------------------------------------------------------------
create or replace function public.applications_reject_if_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.clubs where id = new.club_id;
  if v_owner is not null and public.users_are_blocked(new.user_id, v_owner) then
    raise exception 'users_blocked';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_reject_if_blocked on public.applications;
create trigger applications_reject_if_blocked
  before insert on public.applications
  for each row
  execute function public.applications_reject_if_blocked();

create or replace function public.invitations_reject_if_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if public.users_are_blocked(new.user_id, new.invited_by) then
    raise exception 'users_blocked';
  end if;
  select owner_id into v_owner from public.clubs where id = new.club_id;
  if v_owner is not null and public.users_are_blocked(new.user_id, v_owner) then
    raise exception 'users_blocked';
  end if;
  return new;
end;
$$;

drop trigger if exists invitations_reject_if_blocked on public.invitations;
create trigger invitations_reject_if_blocked
  before insert on public.invitations
  for each row
  execute function public.invitations_reject_if_blocked();

create or replace function public.messages_reject_if_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public."ConversationType";
  v_other uuid;
begin
  select type into v_type from public.conversations where id = new.conversation_id;
  if v_type is distinct from 'DIRECT' then
    return new;
  end if;
  select user_id into v_other
    from public.conversation_members
    where conversation_id = new.conversation_id
      and user_id <> new.sender_id
    limit 1;
  if v_other is not null and public.users_are_blocked(new.sender_id, v_other) then
    raise exception 'users_blocked';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_reject_if_blocked on public.messages;
create trigger messages_reject_if_blocked
  before insert on public.messages
  for each row
  execute function public.messages_reject_if_blocked();

-- Realtime (in-app notifications + hide immédiat). Ignore si déjà dans la publication.
do $pub$
begin
  begin
    alter publication supabase_realtime add table public.user_blocks;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$pub$;

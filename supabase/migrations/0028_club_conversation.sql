-- ==============================================================================
-- ClubPro Connect — Conversation type CLUB (schéma 0016 déjà prêt : enum
-- ConversationType, colonne club_id, index unique partiel
-- conversations_one_club_conversation). AUCUNE nouvelle table, AUCUN nouvel
-- enum, AUCUN second moteur de chat. Réutilise conversations /
-- conversation_members / messages + RLS 0017 (membre = visibilité / envoi).
--
-- NON APPLIQUÉE au projet distant à la date d'écriture. N'AMENDE PAS 0016-0027.
--
-- get-or-create : start_club_conversation(actor, club) — OWNER / MANAGER /
-- MEMBER du club peuvent ouvrir. Membership conversation syncée depuis
-- club_members (rôle ClubRole → ConversationRole : OWNER, MANAGER→ADMIN,
-- MEMBER). Trigger sur club_members pour les joins/leaves APRÈS provision.
-- Clubs déjà existants : pas de backfill silencieux ; première ouverture
-- provisionne. MESSAGE_RECEIVED GROUP/CLUB déjà skip (0025 + Edge notify).
-- ==============================================================================

begin;

-- ClubRole (OWNER/MANAGER/MEMBER) → ConversationRole (OWNER/ADMIN/MEMBER).
create or replace function public.club_role_to_conversation_role(p_role public."ClubRole")
returns public."ConversationRole"
language sql
immutable
as $$
  select case p_role
    when 'OWNER' then 'OWNER'::public."ConversationRole"
    when 'MANAGER' then 'ADMIN'::public."ConversationRole"
    else 'MEMBER'::public."ConversationRole"
  end;
$$;

revoke execute on function public.club_role_to_conversation_role(public."ClubRole") from public, anon;
grant execute on function public.club_role_to_conversation_role(public."ClubRole") to authenticated, service_role;

-- ------------------------------------------------------------------
-- start_club_conversation — get-or-create la conversation CLUB du club
-- (une seule, index unique partiel 0016). SECURITY DEFINER : conversations
-- n'a pas de policy INSERT authenticated (0017). EXECUTE service_role
-- uniquement, via l'Edge start-club-conversation (JWT déjà vérifié).
-- ------------------------------------------------------------------
create or replace function public.start_club_conversation(p_actor_id uuid, p_club_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_actor_role public."ClubRole";
begin
  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'club_not_found';
  end if;

  select role into v_actor_role
    from public.club_members
    where club_id = p_club_id and user_id = p_actor_id;
  if v_actor_role is null then
    raise exception 'not_authorized';
  end if;

  select * into v_conversation
    from public.conversations
    where type = 'CLUB' and club_id = p_club_id
    limit 1;

  if v_conversation.id is null then
    begin
      insert into public.conversations (type, club_id, created_by)
        values ('CLUB', p_club_id, p_actor_id)
        returning * into v_conversation;
    exception when unique_violation then
      select * into v_conversation
        from public.conversations
        where type = 'CLUB' and club_id = p_club_id
        limit 1;
    end;
  end if;

  if v_conversation.id is null then
    raise exception 'club_conversation_missing';
  end if;

  -- Sync complet : membres actuels in, anciens out. Idempotent.
  insert into public.conversation_members (conversation_id, user_id, role)
    select v_conversation.id, m.user_id, public.club_role_to_conversation_role(m.role)
      from public.club_members m
      where m.club_id = p_club_id
    on conflict (conversation_id, user_id) do update
      set role = excluded.role;

  delete from public.conversation_members cm
    where cm.conversation_id = v_conversation.id
      and not exists (
        select 1 from public.club_members m
        where m.club_id = p_club_id and m.user_id = cm.user_id
      );

  return v_conversation;
end;
$$;

revoke execute on function public.start_club_conversation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_club_conversation(uuid, uuid) to service_role;

-- ------------------------------------------------------------------
-- sync_club_conversation_membership — même doctrine que
-- sync_group_conversation_membership (0018). Ne crée PAS la conversation
-- (get-or-create reste start_club_conversation). Si elle n'existe pas
-- encore, no-op : la prochaine ouverture synchronisera tout l'effectif.
-- ------------------------------------------------------------------
create or replace function public.sync_club_conversation_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_conversation_role public."ConversationRole";
  v_club_id uuid;
begin
  if tg_op = 'DELETE' then
    v_club_id := old.club_id;
    select id into v_conversation_id
      from public.conversations
      where club_id = v_club_id and type = 'CLUB';
    if v_conversation_id is not null then
      delete from public.conversation_members
        where conversation_id = v_conversation_id and user_id = old.user_id;
    end if;
    return old;
  end if;

  v_club_id := new.club_id;
  v_conversation_role := public.club_role_to_conversation_role(new.role);

  select id into v_conversation_id
    from public.conversations
    where club_id = v_club_id and type = 'CLUB';
  if v_conversation_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.conversation_members (conversation_id, user_id, role)
      values (v_conversation_id, new.user_id, v_conversation_role)
      on conflict (conversation_id, user_id) do update
        set role = excluded.role;
  elsif tg_op = 'UPDATE' then
    update public.conversation_members
      set role = v_conversation_role
      where conversation_id = v_conversation_id and user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_club_member_conversation_sync on public.club_members;
create trigger on_club_member_conversation_sync
  after insert or update or delete on public.club_members
  for each row execute function public.sync_club_conversation_membership();

commit;

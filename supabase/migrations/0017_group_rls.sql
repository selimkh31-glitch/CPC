-- ==============================================================================
-- ClubPro Connect — RLS/trigger pour les Groupes sociaux (mission "GROUPES
-- SOCIAUX", section 12). À exécuter APRÈS 0016_chat_rls.sql.
--
-- NON APPLIQUÉE au projet distant pendant cette session (voir rapport,
-- section "Ce qui reste").
--
-- Un groupe est distinct d'un club (section 12, en-tête) : identité sociale,
-- pas compétitive. Sa création provisionne atomiquement sa conversation
-- GROUP (trigger `on_group_created`, SECURITY DEFINER) — même doctrine que
-- `on_club_created` (0003_triggers.sql, non modifié par cette migration).
-- ==============================================================================

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- ------------------------------------------------------------------
-- groups — visibilité conditionnée par `visibility` (mission section 22 :
-- "les données privées doivent rester privées", jamais un
-- `select to authenticated using (true)` par défaut). PUBLIC = annuaire
-- consultable par tous les connectés (découverte, "rejoindre"). PRIVATE =
-- réservé à ses membres.
-- ------------------------------------------------------------------
create policy "groups_select_visible" on public.groups
  for select to authenticated using (
    visibility = 'PUBLIC'
    or exists (select 1 from public.group_members m where m.group_id = groups.id and m.user_id = auth.uid())
  );

create policy "groups_insert_owner" on public.groups
  for insert to authenticated with check (auth.uid() = owner_id);

create policy "groups_update_owner" on public.groups
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "groups_delete_owner" on public.groups
  for delete to authenticated using (auth.uid() = owner_id);

-- ------------------------------------------------------------------
-- group_members — visibles par les membres du même groupe (composition
-- privée même pour un groupe PUBLIC, choix produit conservateur — un
-- non-membre voit qu'un groupe existe, pas qui en fait partie).
--
-- INSERT : auto-rejoindre un groupe PUBLIC (rôle MEMBER forcé, jamais un
-- rôle envoyé par le client) ; rejoindre un groupe PRIVATE nécessite une
-- invitation, hors scope de cette session (Phase 2, group_invitations —
-- voir mission section 12 "Optionnel"). DELETE self = "quitter". Pas de
-- policy UPDATE authenticated : un changement de rôle (promotion ADMIN,
-- retrait) passe exclusivement par set_group_member_role() ci-dessous —
-- "un simple changement de rôle envoyé par le client ne doit évidemment pas
-- suffire" (mission section 12, dernière ligne).
-- ------------------------------------------------------------------
create policy "group_members_select_same_group" on public.group_members
  for select to authenticated using (
    exists (select 1 from public.group_members m2 where m2.group_id = group_members.group_id and m2.user_id = auth.uid())
  );

create policy "group_members_join_public" on public.group_members
  for insert to authenticated with check (
    auth.uid() = user_id
    and role = 'MEMBER'
    and exists (select 1 from public.groups g where g.id = group_members.group_id and g.visibility = 'PUBLIC')
  );

create policy "group_members_leave_self" on public.group_members
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- set_group_member_role — seul chemin pour changer le rôle d'un membre
-- (promotion ADMIN, rétrogradation). SECURITY DEFINER, EXECUTE réservé à
-- service_role (atteignable uniquement via une future Edge Function
-- dédiée — non créée dans cette session, schéma/permissions prêts). Vérifie
-- que l'acteur est OWNER du groupe et empêche de dégrader/retirer le rôle du
-- OWNER lui-même (un groupe garde toujours exactement un OWNER).
-- ------------------------------------------------------------------
create or replace function public.set_group_member_role(p_group_id uuid, p_actor_id uuid, p_target_user_id uuid, p_new_role public."GroupRole")
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.group_members;
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.groups where id = p_group_id;
  if v_owner_id is null then
    raise exception 'group_not_found';
  end if;

  if v_owner_id <> p_actor_id then
    raise exception 'not_authorized';
  end if;

  if p_target_user_id = v_owner_id then
    raise exception 'cannot_change_owner_role';
  end if;

  update public.group_members
    set role = p_new_role
    where group_id = p_group_id and user_id = p_target_user_id
    returning * into v_member;

  if v_member is null then
    raise exception 'member_not_found';
  end if;

  return v_member;
end;
$$;

revoke execute on function public.set_group_member_role(uuid, uuid, uuid, public."GroupRole") from public, anon, authenticated;
grant execute on function public.set_group_member_role(uuid, uuid, uuid, public."GroupRole") to service_role;

-- ------------------------------------------------------------------
-- on_group_created — provisionne atomiquement (section 15 : "faire
-- fonctionner groupes + chat + player card ensemble") la conversation GROUP
-- du nouveau groupe + son propriétaire comme premier membre (rôle OWNER,
-- conversation ET groupe). SECURITY DEFINER, même doctrine que
-- handle_new_club() (0003_triggers.sql, non touché).
-- ------------------------------------------------------------------
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  insert into public.group_members (group_id, user_id, role)
    values (new.id, new.owner_id, 'OWNER');

  insert into public.conversations (type, group_id, created_by)
    values ('GROUP', new.id, new.owner_id)
    returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, user_id, role)
    values (v_conversation_id, new.owner_id, 'OWNER');

  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

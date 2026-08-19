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

-- Le OWNER ne peut PAS "quitter" via cette policy — sinon groups.owner_id
-- pointerait vers un utilisateur sans ligne group_members, état incohérent
-- (ni transfert de propriété ni suppression du groupe ne seraient alors
-- possibles proprement). Décision produit volontairement absente cette
-- session (pas de "transférer la propriété") : le OWNER doit supprimer le
-- groupe (groups_delete_owner) s'il veut s'en aller. Vérifié en base, pas
-- seulement côté UI (audit Phase 2, section 17 de la mission).
create policy "group_members_leave_self" on public.group_members
  for delete to authenticated using (
    auth.uid() = user_id
    and not exists (select 1 from public.groups g where g.id = group_members.group_id and g.owner_id = auth.uid())
  );

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

  -- Un groupe garde toujours EXACTEMENT un OWNER (groups.owner_id) : ce
  -- chemin ne doit jamais pouvoir créer un second membre à rôle OWNER (ce
  -- que le type public."GroupRole" autoriserait sans cette garde explicite —
  -- trouvé à l'audit Phase 2, avant toute application de cette migration).
  -- Un vrai transfert de propriété nécessiterait de déplacer groups.owner_id
  -- lui-même, hors scope ici.
  if p_new_role = 'OWNER' then
    raise exception 'cannot_grant_owner_role';
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

-- ------------------------------------------------------------------
-- sync_group_conversation_membership — GAP trouvé à l'audit Phase 2 (avant
-- toute application distante) : handle_new_group() n'ajoute que le OWNER à
-- la conversation GROUP au moment de la création. Un membre qui rejoint
-- ENSUITE (group_members_join_public) ou qui quitte (group_members_leave_self)
-- n'était PAS répercuté sur conversation_members — il rejoignait le groupe
-- sans jamais pouvoir voir ni écrire dans son chat (bloqué par
-- conversations_select_member / messages_insert_member, 0016_chat_rls.sql),
-- silencieusement, sans erreur explicite. Ce trigger tient les deux tables
-- synchronisées pour INSERT (rejoindre), UPDATE (set_group_member_role,
-- répercute le rôle), et DELETE (quitter).
--
-- SECURITY DEFINER (bypass RLS pour écrire dans conversation_members, table
-- sans policy INSERT/UPDATE authenticated — voir 0016_chat_rls.sql). Ne fait
-- rien si la conversation GROUP n'existe pas encore (cas du tout premier
-- INSERT dans group_members, fait par handle_new_group() lui-même AVANT
-- que la conversation ne soit créée — cette même fonction insère alors
-- explicitement la ligne conversation_members du OWNER, pas de doublon
-- possible grâce à `on conflict do nothing`).
-- ------------------------------------------------------------------
create or replace function public.sync_group_conversation_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_conversation_role public."ConversationRole";
begin
  if tg_op = 'DELETE' then
    select id into v_conversation_id from public.conversations where group_id = old.group_id and type = 'GROUP';
    if v_conversation_id is not null then
      delete from public.conversation_members where conversation_id = v_conversation_id and user_id = old.user_id;
    end if;
    return old;
  end if;

  -- INSERT et UPDATE : group_members.role (GroupRole) -> conversation_members.role
  -- (ConversationRole), mêmes libellés (OWNER/ADMIN/MEMBER), types distincts.
  v_conversation_role := new.role::text::public."ConversationRole";

  select id into v_conversation_id from public.conversations where group_id = new.group_id and type = 'GROUP';
  if v_conversation_id is null then
    return new; -- conversation pas encore créée (tout premier membre, voir handle_new_group()).
  end if;

  if tg_op = 'INSERT' then
    insert into public.conversation_members (conversation_id, user_id, role)
      values (v_conversation_id, new.user_id, v_conversation_role)
      on conflict (conversation_id, user_id) do nothing;
  elsif tg_op = 'UPDATE' then
    update public.conversation_members
      set role = v_conversation_role
      where conversation_id = v_conversation_id and user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_group_member_change on public.group_members;
create trigger on_group_member_change
  after insert or update or delete on public.group_members
  for each row execute function public.sync_group_conversation_membership();

-- ==============================================================================
-- ClubPro Connect — RLS/RPC pour le Chat (mission "CHAT — VRAIE FONDATION",
-- section 11). À exécuter APRÈS prisma/migrations/20260820000000_social_foundations.
--
-- NON APPLIQUÉE au projet distant pendant cette session (voir rapport,
-- section "Ce qui reste"). Grants table-level + schema USAGE déjà couverts
-- par les default privileges posés dans 0006_fix_schema_grants.sql pour
-- toute nouvelle table (authenticated/service_role) — sauf `role` sur
-- conversation_members, explicitement restreint plus bas (même doctrine que
-- push_token sur `users`, 0006_fix_schema_grants.sql).
--
-- Type CLUB : schéma prêt (colonne club_id, index unique partiel) mais
-- AUCUNE Edge Function ne le provisionne dans cette session — Phase 2.
-- ==============================================================================

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- ------------------------------------------------------------------
-- conversations — visibles uniquement par leurs membres. Aucune policy
-- INSERT/UPDATE/DELETE pour `authenticated` : toute création passe par
-- start_direct_conversation() (RPC ci-dessous, service_role uniquement) ou,
-- pour GROUP, par le trigger on_group_created (0017_group_rls.sql). Même
-- principe que season_stats (0002_rls_policies.sql) : l'absence de policy
-- bloque la commande pour ce rôle, indépendamment des grants table-level.
-- ------------------------------------------------------------------
create policy "conversations_select_member" on public.conversations
  for select to authenticated using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversations.id and cm.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------
-- conversation_members — visibles par les autres membres de la MÊME
-- conversation uniquement (jamais par un tiers). Auto-jointure volontaire
-- (cm2) : "je peux voir une ligne de conversation_members si je suis
-- moi-même membre de la conversation qu'elle référence".
--
-- Écriture : aucune policy INSERT (ajout de membres = RPC/trigger
-- service_role uniquement, jamais un INSERT client direct — évite qu'un
-- joueur s'ajoute lui-même à une conversation privée). DELETE self réservé à
-- "quitter" (section 12). UPDATE limité à sa propre ligne ET column-level
-- restreint à `last_read_at` : un simple UPDATE role envoyé par le client ne
-- doit jamais suffire à s'auto-promouvoir (risque explicitement identifié,
-- mission section 12/9).
-- ------------------------------------------------------------------
create policy "conversation_members_select_same_conversation" on public.conversation_members
  for select to authenticated using (
    exists (
      select 1 from public.conversation_members cm2
      where cm2.conversation_id = conversation_members.conversation_id and cm2.user_id = auth.uid()
    )
  );

create policy "conversation_members_leave_self" on public.conversation_members
  for delete to authenticated using (auth.uid() = user_id);

create policy "conversation_members_update_self" on public.conversation_members
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

-- ------------------------------------------------------------------
-- messages — visibles par les membres de la conversation. `sender_id`
-- toujours dérivé du JWT (with check), jamais fourni "en confiance" par le
-- client (mission section 11 : "impossible d'envoyer un message au nom d'un
-- autre utilisateur"). Édition/suppression (soft-delete via deleted_at)
-- réservées à l'auteur, column-level restreint à body/edited_at/deleted_at —
-- un UPDATE ne peut jamais réassigner sender_id ou conversation_id.
-- ------------------------------------------------------------------
create policy "messages_select_member" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
    )
  );

create policy "messages_insert_member" on public.messages
  for insert to authenticated with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
    )
  );

-- AUDIT (post-session, priorité mission "PHASE 3") : cette policy seule
-- (using/with check sur sender_id) ne borne QUE sender_id — rien dans son
-- texte n'empêche un UPDATE de réassigner conversation_id sur son propre
-- message. Le blocage réel vient du GRANT UPDATE column-level ci-dessous :
-- Postgres vérifie les privilèges UPDATE par colonne indépendamment des
-- policies RLS, AVANT même d'évaluer using/with check sur les colonnes hors
-- grant. Avec seulement `grant update (body, edited_at, deleted_at)`, toute
-- tentative d'UPDATE incluant conversation_id (ou sender_id) dans son SET —
-- y compris via `.update({ conversation_id: ... })` côté PostgREST/supabase-js
-- — échoue par "permission denied for column", quel que soit le contenu de
-- cette policy. Conclusion de l'audit : PAS exploitable, déjà mitigé par le
-- grant colonne (pas seulement "documenté comme risque résiduel").
create policy "messages_update_own" on public.messages
  for update to authenticated
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

revoke update on public.messages from authenticated;
grant update (body, edited_at, deleted_at) on public.messages to authenticated;

-- ------------------------------------------------------------------
-- start_direct_conversation — création atomique d'une conversation DIRECT
-- entre p_actor_id et p_other_user_id, avec dédoublonnage (une seule
-- conversation DIRECT par paire d'utilisateurs, peu importe l'ordre).
-- SECURITY DEFINER : bypass RLS pour insérer les 2 conversation_members
-- (l'autre utilisateur n'a rien demandé lui-même) — même doctrine que
-- accept_invitation() (0007_match_sheet_rls.sql). EXECUTE réservé à
-- service_role : atteignable uniquement via l'Edge Function
-- start-direct-conversation, qui a déjà vérifié le JWT appelant.
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

  -- Dédoublonnage : conversation DIRECT existante partagée par les deux
  -- utilisateurs (peu importe qui l'a créée à l'origine).
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

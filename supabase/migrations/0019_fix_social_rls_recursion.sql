-- ==============================================================================
-- ClubPro Connect — Correctif CRITIQUE : récursion RLS infinie (Social
-- Foundations). NON APPLIQUÉE au distant à la date d'écriture — écrite et
-- auditée en phase de conception uniquement, application différée.
--
-- BUG CONFIRMÉ EN PRODUCTION (test réel, pas une hypothèse) :
--   ERROR 42P17: infinite recursion detected in policy for relation
--   "conversation_members" / "group_members"
--
-- Cause : `conversation_members_select_same_conversation` (0017_chat_rls.sql)
-- et `group_members_select_same_group` (0018_group_rls.sql) font toutes deux
-- un EXISTS auto-référentiel sur leur propre table protégée par RLS. Postgres
-- réécrit une policy en réappliquant récursivement la RLS de toute table
-- qu'elle référence — quand cette table EST la table protégée elle-même,
-- cette expansion ne termine jamais ; Postgres le détecte et refuse la
-- requête plutôt que de boucler indéfiniment.
--
-- Portée réelle confirmée par test direct (pas seulement les 2 policies
-- fautives) : conversations, messages et groups sont cassées
-- TRANSITIVEMENT — leurs policies respectives font un EXISTS sur
-- conversation_members/group_members, qui héritent de la policy récursive
-- de CES tables. Corriger UNIQUEMENT les 2 policies auto-référentielles
-- ci-dessous répare donc l'intégralité de la chaîne (tracé de dépendance
-- complet dans le rapport de session, aucune des 10 autres policies
-- Social Foundations n'est elle-même auto-référentielle).
--
-- STRATÉGIE (voir rapport de session pour la comparaison A/B complète) :
-- fonction SECURITY DEFINER scalaire minimale par table concernée. Une
-- fonction SECURITY DEFINER s'exécute avec les privilèges de son
-- PROPRIÉTAIRE (postgres), qui contourne nativement RLS sur ses propres
-- tables — c'est ce contournement, PAS un contournement de la logique
-- métier, qui casse la boucle : la requête interne (`EXISTS (...)`) est
-- rigoureusement identique à celle de la policy d'origine, seule son
-- exécution échappe à la ré-application récursive de la même policy.
-- Aucune donnée n'est exposée au-delà d'un booléen ; aucune écriture ;
-- aucun paramètre ne permet de modifier un rôle ou une permission.
--
-- NE TOUCHE À AUCUNE TABLE MÉTIER HORS SOCIAL FOUNDATIONS. NE MODIFIE
-- AUCUNE MIGRATION 0001-0018 (fichier séparé, additif). Les 4 fonctions
-- SECURITY DEFINER pré-existantes (start_direct_conversation,
-- set_group_member_role, handle_new_group, sync_group_conversation_membership)
-- ne sont PAS concernées par ce bug (elles écrivent directement, sans jamais
-- re-soumettre leurs requêtes internes à RLS) et ne sont pas modifiées ici.
--
-- Idempotence : CREATE OR REPLACE FUNCTION est idempotent (sûr à ré-exécuter).
-- DROP POLICY IF EXISTS + CREATE POLICY reproduit le seul point non-idempotent
-- déjà présent dans 0016-0018 (Postgres n'a pas de CREATE POLICY IF NOT
-- EXISTS) — ne pas rejouer ce fichier sur un schéma déjà corrigé sans
-- l'auditer au préalable, même limite déjà documentée pour 0017/0018.
-- Transaction explicite : soit les 2 correctifs s'appliquent ensemble, soit
-- aucun (jamais d'état intermédiaire où une seule des deux tables serait
-- corrigée).
-- ==============================================================================

begin;

-- ------------------------------------------------------------------
-- is_conversation_member — casse la récursion sur conversation_members.
-- LANGUAGE sql (prédicat trivial, un seul EXISTS) + STABLE (ne modifie rien,
-- résultat constant pour les mêmes arguments au sein d'une même requête —
-- permet à Postgres de réutiliser le résultat entre lignes si pertinent).
-- Bénéficie de l'index unique conversation_members_conversation_id_user_id_key
-- (0016_social_foundations.sql) — recherche indexée, pas de scan.
--
-- EXECUTE accordé à `authenticated` : NÉCESSAIRE ici, contrairement aux
-- fonctions SECURITY DEFINER existantes (accessibles uniquement via
-- service_role) — cette fonction est appelée DEPUIS une policy évaluée dans
-- le contexte du rôle `authenticated` lui-même, elle doit donc lui être
-- directement exécutable. `anon`/`public` explicitement exclus (jamais
-- authentifié dans cette app, même doctrine que le reste du schéma).
-- ------------------------------------------------------------------
create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id
  );
$$;

revoke execute on function public.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------------
-- is_group_member — même doctrine, pour group_members. Bénéficie de
-- l'index unique group_members_group_id_user_id_key.
-- ------------------------------------------------------------------
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

revoke execute on function public.is_group_member(uuid, uuid) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------------
-- Policies corrigées — MÊME PÉRIMÈTRE DE SÉCURITÉ que l'original (un membre
-- voit les lignes de sa conversation/son groupe, un non-membre n'en voit
-- aucune) : seul le mécanisme d'évaluation change, jamais le résultat pour
-- un utilisateur donné. Les 12 autres policies (conversations, messages,
-- groups, group_members_join_public, group_members_leave_self, etc.) ne
-- sont PAS touchées — elles continuent de faire leur EXISTS habituel sur
-- ces deux tables et se réparent transitivement une fois ces 2 policies
-- corrigées (aucune n'est elle-même auto-référentielle, voir rapport).
-- ------------------------------------------------------------------
drop policy if exists "conversation_members_select_same_conversation" on public.conversation_members;
create policy "conversation_members_select_same_conversation" on public.conversation_members
  for select to authenticated using (
    public.is_conversation_member(conversation_members.conversation_id, auth.uid())
  );

drop policy if exists "group_members_select_same_group" on public.group_members;
create policy "group_members_select_same_group" on public.group_members
  for select to authenticated using (
    public.is_group_member(group_members.group_id, auth.uid())
  );

commit;

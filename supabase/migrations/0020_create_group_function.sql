-- ==============================================================================
-- ClubPro Connect — Correctif : création d'un groupe PRIVATE échouait.
-- NON APPLIQUÉE au distant à la date d'écriture. N'AMENDE PAS 0016-0019
-- (fichier séparé, additif).
--
-- CAUSE (diagnostiquée et reproduite empiriquement) : `useCreateGroup()`
-- fait `INSERT INTO groups (...) RETURNING *` (via
-- `.insert(...).select("*").single()`). Le trigger `on_group_created`
-- (0018_group_rls.sql, INCHANGÉ) peuple `group_members`/`conversations`/
-- `conversation_members` dans la même transaction, mais la clause
-- `RETURNING` exige que la ligne nouvellement insérée satisfasse la policy
-- SELECT `groups_select_visible` — pour un groupe PRIVATE, cette policy ne
-- s'appuie QUE sur l'appartenance à `group_members`, qui n'est pas encore
-- "visible" pour cette évaluation précise. Confirmé par test direct : le
-- même INSERT SANS `RETURNING` réussit systématiquement. PUBLIC n'est pas
-- affecté (visibility='PUBLIC' seul suffit, indépendamment de group_members).
--
-- CORRECTIF (Solution B, voir rapport de session — comparaison A/B/C) :
-- une fonction SECURITY DEFINER dédiée à la création, dont le `RETURN`
-- n'est JAMAIS soumis à une ré-évaluation RLS (contrairement à un
-- `RETURNING` de table) — fonctionne donc identiquement pour PUBLIC et
-- PRIVATE, sans dépendre d'aucun ordonnancement trigger/RETURNING.
--
-- `owner_id` n'est PAS un paramètre : dérivé de `p_actor_id`, lui-même
-- fourni UNIQUEMENT par l'Edge Function appelante (create-group) à partir
-- du JWT vérifié — jamais du corps de la requête client, même principe que
-- start_direct_conversation()/set_group_member_role() (0017/0018,
-- inchangés). EXECUTE réservé à service_role — AUCUNE nouvelle surface RPC
-- cliente : ce repo n'a jamais accordé EXECUTE sur une fonction
-- SECURITY DEFINER directement à `authenticated`, ce correctif ne rompt pas
-- ce précédent.
--
-- Ne touche à AUCUNE policy RLS, AUCUNE table, AUCUN trigger existant.
-- Le trigger on_group_created continue de s'exécuter normalement (les
-- triggers ne sont jamais désactivés par un contexte SECURITY DEFINER).
-- ==============================================================================

begin;

create or replace function public.create_group(
  p_actor_id uuid,
  p_name text,
  p_description text,
  p_visibility public."GroupVisibility"
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
  v_name text;
begin
  v_name := trim(p_name);
  if v_name is null or length(v_name) = 0 then
    raise exception 'name_required';
  end if;
  if length(v_name) > 60 then
    raise exception 'name_too_long';
  end if;

  insert into public.groups (name, description, owner_id, visibility)
    values (v_name, nullif(trim(coalesce(p_description, '')), ''), p_actor_id, p_visibility)
    returning * into v_group;

  -- Le trigger on_group_created (0018_group_rls.sql) vient de s'exécuter
  -- (même transaction, synchrone) : group_members/conversations/
  -- conversation_members sont déjà peuplés à ce stade. `v_group` est la
  -- valeur RETURNING de l'INSERT ci-dessus, jamais relue via une requête
  -- SELECT séparée soumise à RLS — c'est précisément ce qui évite le bug.
  return v_group;
end;
$$;

revoke execute on function public.create_group(uuid, text, text, public."GroupVisibility") from public, anon, authenticated;
grant execute on function public.create_group(uuid, text, text, public."GroupVisibility") to service_role;

commit;

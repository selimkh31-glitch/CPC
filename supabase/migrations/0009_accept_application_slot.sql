-- ==============================================================================
-- ClubPro Connect — Phase 4 : accept_application() crée aussi le SlotAssignment.
--
-- Cause : applications.slot_id (phase 2) permet une candidature sur un slot
-- précis, mais accept_application() (0005) ignorait ce champ — un joueur
-- accepté rejoignait le club sans jamais occuper visuellement son slot sur la
-- feuille de match (formation + SlotAssignment = source de vérité, jamais une
-- seconde logique indépendante). Cette migration ÉTEND la fonction existante
-- (CREATE OR REPLACE, même nom/signature) plutôt que de la réécrire : le
-- comportement pré-existant (verrouillage, anti-surbooking sur
-- needed_positions, ajout club_member) est strictement conservé, seule
-- l'assignation de slot est ajoutée — même logique, mot pour mot, que
-- accept_invitation() (0007) pour la cohérence.
-- ==============================================================================

create or replace function public.accept_application(p_application_id uuid, p_actor_id uuid)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_session public.club_sessions;
  v_is_manager boolean;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if v_app is null then
    raise exception 'application_not_found';
  end if;

  select exists(
    select 1 from public.club_members m
    where m.club_id = v_app.club_id and m.user_id = p_actor_id and m.role in ('OWNER', 'MANAGER')
  ) into v_is_manager;
  if not v_is_manager then
    raise exception 'not_authorized';
  end if;

  if v_app.status <> 'PENDING' then
    raise exception 'application_not_pending';
  end if;

  select * into v_session from public.club_sessions where id = v_app.session_id for update;
  if v_session is null or not (v_app.position = any(v_session.needed_positions)) then
    raise exception 'position_unavailable';
  end if;

  update public.club_sessions
    set needed_positions = array_remove(needed_positions, v_app.position)
    where id = v_session.id;

  -- Nouveau (phase 4) : assignation atomique du slot précis si la candidature
  -- en visait un (slot_id nullable — rétrocompatible avec les candidatures
  -- "position large" existantes, qui laissent slot_id = null et ne touchent
  -- jamais slot_assignments).
  if v_app.slot_id is not null then
    if exists (
      select 1 from public.slot_assignments s
      where s.club_id = v_app.club_id and s.slot_id = v_app.slot_id
    ) then
      raise exception 'slot_unavailable';
    end if;

    begin
      insert into public.slot_assignments (club_id, slot_id, user_id)
        values (v_app.club_id, v_app.slot_id, v_app.user_id);
    exception when unique_violation then
      raise exception 'slot_unavailable';
    end;
  end if;

  update public.applications
    set status = 'ACCEPTED'
    where id = p_application_id
    returning * into v_app;

  insert into public.club_members (club_id, user_id, role)
    values (v_app.club_id, v_app.user_id, 'MEMBER')
    on conflict (club_id, user_id) do nothing;

  return v_app;
end;
$$;

-- Grants inchangés (déjà posés par 0005/0006/0008) : EXECUTE reste
-- service_role uniquement — CREATE OR REPLACE ne modifie jamais les
-- privilèges existants sur la fonction, mais on le réaffirme explicitement
-- par prudence après l'incident de restauration.
revoke execute on function public.accept_application(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_application(uuid, uuid) to service_role;

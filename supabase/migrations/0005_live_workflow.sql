-- ==============================================================================
-- ClubPro Connect — Finalisation du workflow LIVE / matchmaking.
-- À exécuter APRÈS prisma/migrations/20260816000000_application_position_withdrawn
-- (colonne applications.position + valeur enum WITHDRAWN).
-- ==============================================================================

-- ------------------------------------------------------------------
-- 1) Retrait de candidature par son propriétaire (PENDING -> WITHDRAWN
--    uniquement, historique conservé — jamais de suppression physique).
--    Policy indépendante de "applications_update_manager" (RLS permissive,
--    les deux coexistent sans se substituer l'une à l'autre).
-- ------------------------------------------------------------------
create policy "applications_withdraw_self" on public.applications
  for update to authenticated
  using (auth.uid() = user_id and status = 'PENDING')
  with check (auth.uid() = user_id and status = 'WITHDRAWN');

-- ------------------------------------------------------------------
-- 2) Une seule session LIVE active par club — contrainte DB (au lieu du seul
--    garde-fou applicatif dans useCreateSession). Index partiel : n'affecte
--    que les lignes is_live = true, aucune session existante n'est modifiée.
-- ------------------------------------------------------------------
create unique index if not exists club_sessions_one_live_per_club
  on public.club_sessions (club_id)
  where is_live;

-- ------------------------------------------------------------------
-- 3) Acceptation atomique d'une candidature (anti-surbooking).
--    SECURITY DEFINER : verrouille la candidature ET la session (FOR UPDATE)
--    pour qu'une seconde acceptation concurrente sur le même poste échoue
--    proprement plutôt que de créer un surbooking. Appelée uniquement par les
--    Edge Functions (service_role) — EXECUTE explicitement révoqué pour
--    anon/authenticated pour ne jamais être exposée en RPC direct côté client.
-- ------------------------------------------------------------------
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

revoke execute on function public.accept_application(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_application(uuid, uuid) to service_role;

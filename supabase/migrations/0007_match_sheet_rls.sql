-- ==============================================================================
-- ClubPro Connect — RLS/RPC pour le modèle Feuille de match (phase 2).
-- À exécuter APRÈS prisma/migrations/20260817000000_match_sheet_model.
-- Nouvelles tables : slot_assignments, invitations. Grants table-level +
-- schema USAGE déjà couverts automatiquement par les default privileges
-- posés dans 0006_fix_schema_grants.sql (authenticated/service_role
-- uniquement — anon n'y figure pas et ne reçoit toujours rien ici).
-- ==============================================================================

alter table public.slot_assignments enable row level security;
alter table public.invitations enable row level security;

-- ------------------------------------------------------------------
-- slot_assignments — visibles par tout utilisateur connecté (composition
-- publique d'un club, comme club_members/club_sessions), gérées par
-- owner/manager du club uniquement. La suppression d'une ligne ici ne
-- touche jamais club_members (relation indépendante, voir schema.prisma).
-- ------------------------------------------------------------------
create policy "slot_assignments_select_authenticated" on public.slot_assignments
  for select to authenticated using (true);

create policy "slot_assignments_write_manager" on public.slot_assignments
  for all to authenticated using (
    exists (
      select 1 from public.club_members m
      where m.club_id = slot_assignments.club_id and m.user_id = auth.uid() and m.role in ('OWNER', 'MANAGER')
    )
  ) with check (
    exists (
      select 1 from public.club_members m
      where m.club_id = slot_assignments.club_id and m.user_id = auth.uid() and m.role in ('OWNER', 'MANAGER')
    )
  );

-- ------------------------------------------------------------------
-- invitations — privées : visibles par l'invité et le owner/manager du club
-- concerné uniquement (jamais par un tiers, contrairement à slot_assignments).
-- Écriture réelle (création, acceptation) prévue via Edge Functions
-- service_role dans une phase ultérieure ; ces policies restent en défense
-- en profondeur, même principe que applications (voir 0002_rls_policies.sql).
--
-- L'acceptation (PENDING -> ACCEPTED) n'est PAS autorisée en écriture directe
-- authenticated : elle doit obligatoirement passer par accept_invitation()
-- (atomique, assignation de slot + club_member inclus). Seul le refus
-- (-> DECLINED) et l'annulation (-> CANCELLED) sont de simples changements de
-- statut sans effet de bord, donc autorisés en direct.
-- ------------------------------------------------------------------
create policy "invitations_select_involved" on public.invitations
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.club_members m
      where m.club_id = invitations.club_id and m.user_id = auth.uid() and m.role in ('OWNER', 'MANAGER')
    )
  );

create policy "invitations_insert_manager" on public.invitations
  for insert to authenticated with check (
    exists (
      select 1 from public.club_members m
      where m.club_id = invitations.club_id and m.user_id = auth.uid() and m.role in ('OWNER', 'MANAGER')
    )
  );

create policy "invitations_decline_self" on public.invitations
  for update to authenticated
  using (auth.uid() = user_id and status = 'PENDING')
  with check (auth.uid() = user_id and status = 'DECLINED');

create policy "invitations_cancel_manager" on public.invitations
  for update to authenticated
  using (
    status = 'PENDING'
    and exists (
      select 1 from public.club_members m
      where m.club_id = invitations.club_id and m.user_id = auth.uid() and m.role in ('OWNER', 'MANAGER')
    )
  )
  with check (status = 'CANCELLED');

-- ------------------------------------------------------------------
-- Acceptation atomique d'une invitation (anti-double-attribution).
-- SECURITY DEFINER : verrouille l'invitation (FOR UPDATE) et s'appuie sur les
-- contraintes uniques de slot_assignments comme garde-fou final contre une
-- course concurrente entre deux invitations distinctes visant le même slot.
--
-- L'appartenance de slot_id à la formation courante du club (Club.formation)
-- N'EST PAS vérifiable ici : le catalogue des formations est volontairement
-- absent de la base (source de vérité = lib/formations.ts côté application).
-- Cette vérification est de la responsabilité de l'Edge Function appelante
-- (respond-invitation, phase ultérieure) avant l'appel à cette fonction.
--
-- EXECUTE réservé à service_role — jamais anon/authenticated, cohérent avec
-- accept_application() (0005_live_workflow.sql) : cette fonction ne doit être
-- atteignable que via l'Edge Function encapsulante, jamais en RPC direct.
-- ------------------------------------------------------------------
create or replace function public.accept_invitation(p_invitation_id uuid, p_actor_id uuid)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if v_inv is null then
    raise exception 'invitation_not_found';
  end if;

  if v_inv.user_id <> p_actor_id then
    raise exception 'not_authorized';
  end if;

  if v_inv.status <> 'PENDING' then
    raise exception 'invitation_not_pending';
  end if;

  if v_inv.slot_id is not null then
    if exists (
      select 1 from public.slot_assignments s
      where s.club_id = v_inv.club_id and s.slot_id = v_inv.slot_id
    ) then
      raise exception 'slot_unavailable';
    end if;

    begin
      insert into public.slot_assignments (club_id, slot_id, user_id)
        values (v_inv.club_id, v_inv.slot_id, v_inv.user_id);
    exception when unique_violation then
      -- Course concurrente : une autre invitation/assignation a pris le slot
      -- (ou ce joueur occupe déjà un autre slot du même club) entre la
      -- vérification ci-dessus et cet INSERT.
      raise exception 'slot_unavailable';
    end;
  end if;

  insert into public.club_members (club_id, user_id, role)
    values (v_inv.club_id, v_inv.user_id, 'MEMBER')
    on conflict (club_id, user_id) do nothing;

  update public.invitations
    set status = 'ACCEPTED'
    where id = p_invitation_id
    returning * into v_inv;

  return v_inv;
end;
$$;

revoke execute on function public.accept_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_invitation(uuid, uuid) to service_role;

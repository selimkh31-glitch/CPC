-- ==============================================================================
-- ClubPro Connect — Lien match_results → club adverse CPC + compétition optionnelle.
-- À appliquer APRÈS 0026_competitions_foundation.sql, via SQL Editor Supabase
-- ou `npx prisma db execute --file supabase/migrations/0027_match_result_competition_link.sql`
-- (Option B). Miroir Prisma dans schema.prisma uniquement — NE PAS
-- `prisma migrate deploy` (double-apply).
-- L'agent n'applique PAS cette migration en production.
--
-- Portée de ce slice (et seulement ça) :
--   1) Colonnes nullable `opponent_club_id` (FK clubs) et `competition_id`
--      (FK competitions) sur `match_results`.
--   2) CHECK opponent_club_id IS DISTINCT FROM club_id (NULL autorisé).
--   3) Si competition_id est posé : club_id ET opponent_club_id doivent
--      figurer dans competition_clubs pour CETTE compétition (trigger).
--   4) finalize_match accepte p_opponent_club_id / p_competition_id optionnels.
--      Toujours service_role ; OWNER/MANAGER de club_id ; scores ≥ 0 ;
--      outcome toujours calculé serveur.
--   5) RLS inchangée : SELECT authenticated ; aucune INSERT client.
--
-- PAS de table standings : le classement se calcule depuis les lignes
-- match_results réellement liées (competition_id + opponent_club_id).
-- ==============================================================================

-- ------------------------------------------------------------------
-- 1) Colonnes + FKs + CHECK
-- ------------------------------------------------------------------
alter table public.match_results
  add column if not exists opponent_club_id uuid,
  add column if not exists competition_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'match_results_opponent_not_self'
  ) then
    alter table public.match_results
      add constraint match_results_opponent_not_self
      check (opponent_club_id is distinct from club_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'match_results_opponent_club_id_fkey'
  ) then
    alter table public.match_results
      add constraint match_results_opponent_club_id_fkey
      foreign key (opponent_club_id) references public.clubs(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'match_results_competition_id_fkey'
  ) then
    alter table public.match_results
      add constraint match_results_competition_id_fkey
      foreign key (competition_id) references public.competitions(id) on delete set null;
  end if;
end $$;

create index if not exists match_results_opponent_club_id_idx
  on public.match_results (opponent_club_id);
create index if not exists match_results_competition_id_idx
  on public.match_results (competition_id);

-- ------------------------------------------------------------------
-- 2) Trigger — si competition_id : les deux clubs doivent être inscrits
-- ------------------------------------------------------------------
create or replace function public.match_results_competition_clubs_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.competition_id is not null then
    if new.opponent_club_id is null then
      raise exception 'competition_requires_opponent';
    end if;
    if not exists (
      select 1 from public.competition_clubs
      where competition_id = new.competition_id and club_id = new.club_id
    ) or not exists (
      select 1 from public.competition_clubs
      where competition_id = new.competition_id and club_id = new.opponent_club_id
    ) then
      raise exception 'clubs_not_in_competition';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists match_results_competition_clubs_guard on public.match_results;
create trigger match_results_competition_clubs_guard
  before insert or update on public.match_results
  for each row
  execute function public.match_results_competition_clubs_guard();

-- ------------------------------------------------------------------
-- 3) finalize_match — mêmes gardes 0014 + opponent/compétition optionnels.
--    DROP de la signature 5 args (0014) pour éviter un overload PostgREST.
-- ------------------------------------------------------------------
drop function if exists public.finalize_match(uuid, uuid, int, int, uuid);

create or replace function public.finalize_match(
  p_match_checkin_id uuid,
  p_actor_id uuid,
  p_our_score int,
  p_opponent_score int,
  p_mvp_user_id uuid default null,
  p_opponent_club_id uuid default null,
  p_competition_id uuid default null
)
returns public.match_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkin public.match_checkins;
  v_is_manager boolean;
  v_outcome "MatchOutcome";
  v_result public.match_results;
  v_competition_status text;
begin
  if p_our_score < 0 or p_opponent_score < 0 then
    raise exception 'invalid_score';
  end if;

  select * into v_checkin from public.match_checkins where id = p_match_checkin_id for update;
  if v_checkin is null then
    raise exception 'checkin_not_found';
  end if;

  select exists(
    select 1 from public.club_members m
    where m.club_id = v_checkin.club_id and m.user_id = p_actor_id and m.role in ('OWNER', 'MANAGER')
  ) into v_is_manager;
  if not v_is_manager then
    raise exception 'not_authorized';
  end if;

  if exists (select 1 from public.match_results where match_checkin_id = p_match_checkin_id) then
    raise exception 'already_finalized';
  end if;

  if p_mvp_user_id is not null and not exists (
    select 1 from public.match_participations
    where match_checkin_id = p_match_checkin_id and user_id = p_mvp_user_id and status = 'PRESENT'
  ) then
    raise exception 'mvp_not_present';
  end if;

  if p_opponent_club_id is not null then
    if p_opponent_club_id is not distinct from v_checkin.club_id then
      raise exception 'opponent_is_self';
    end if;
    if not exists (select 1 from public.clubs where id = p_opponent_club_id) then
      raise exception 'opponent_not_found';
    end if;
  end if;

  if p_competition_id is not null then
    if p_opponent_club_id is null then
      raise exception 'competition_requires_opponent';
    end if;
    select status into v_competition_status from public.competitions where id = p_competition_id;
    if v_competition_status is null then
      raise exception 'competition_not_found';
    end if;
    if v_competition_status is distinct from 'OPEN' then
      raise exception 'competition_not_open';
    end if;
    if not exists (
      select 1 from public.competition_clubs
      where competition_id = p_competition_id and club_id = v_checkin.club_id
    ) or not exists (
      select 1 from public.competition_clubs
      where competition_id = p_competition_id and club_id = p_opponent_club_id
    ) then
      raise exception 'clubs_not_in_competition';
    end if;
  end if;

  v_outcome := case
    when p_our_score > p_opponent_score then 'WIN'
    when p_our_score < p_opponent_score then 'LOSS'
    else 'DRAW'
  end;

  insert into public.match_results (
    match_checkin_id, club_id, our_score, opponent_score, outcome, mvp_user_id, recorded_by,
    opponent_club_id, competition_id
  )
    values (
      p_match_checkin_id, v_checkin.club_id, p_our_score, p_opponent_score, v_outcome,
      p_mvp_user_id, p_actor_id, p_opponent_club_id, p_competition_id
    )
    returning * into v_result;

  return v_result;
end;
$$;

revoke execute on function public.finalize_match(uuid, uuid, int, int, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_match(uuid, uuid, int, int, uuid, uuid, uuid) to service_role;

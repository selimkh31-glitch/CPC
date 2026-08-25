-- ==============================================================================
-- ClubPro Connect — Tournois V1 (EA SPORTS FC 27 Pro Clubs).
-- À appliquer APRÈS 0027_match_result_competition_link.sql, via SQL Editor
-- Supabase ou `npx prisma db execute --file supabase/migrations/0029_tournaments_v1.sql`
-- (Option B). Miroir Prisma dans schema.prisma uniquement — NE PAS
-- `prisma migrate deploy` (double-apply).
-- L'agent n'applique PAS cette migration en production.
--
-- Un tournoi N'EST PAS une 2e table compétition : c'est une compétition
-- avec kind = TOURNAMENT (statuts DRAFT|OPEN|CLOSED, inscriptions
-- competition_clubs, résultats via match_results.competition_id).
--
-- Portée de ce slice (et seulement ça) :
--   1) Colonne `kind` COMPETITION|TOURNAMENT (défaut COMPETITION = existant).
--   2) Table `tournament_matches` — paires persistées (club_a_id, club_b_id,
--      round, slot, status SCHEDULED|PLAYED). Aucun score sur cette table.
--   3) RLS lecture authenticated (OPEN ou créateur) ; INSERT client interdit
--      (génération 1er tour = Edge service_role). PLAYED uniquement via
--      trigger quand un match_results lié existe pour la paire.
--   4) Policy INSERT compétitions authenticated limitée à kind=COMPETITION
--      (un tournoi se crée via Edge create-tournament / service_role).
--
-- PAS de table tournaments dupliquée, PAS de classement saison globale,
-- PAS de ligues, PAS de scores 0-0 inventés, PAS de bracket décoratif.
-- Pool par tour : tournament_round_clubs (clubs du tour au moment du tirage).
-- ==============================================================================

-- ------------------------------------------------------------------
-- 1) kind sur competitions
-- ------------------------------------------------------------------
alter table public.competitions
  add column if not exists kind text not null default 'COMPETITION';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'competitions_kind_check'
  ) then
    alter table public.competitions
      add constraint competitions_kind_check
      check (kind in ('COMPETITION', 'TOURNAMENT'));
  end if;
end $$;

create index if not exists competitions_kind_idx on public.competitions (kind);

-- Création client : compétition standard seulement. Tournoi = Edge service_role.
drop policy if exists "competitions_insert_creator" on public.competitions;
create policy "competitions_insert_creator" on public.competitions
  for insert to authenticated with check (
    created_by = auth.uid()
    and status in ('DRAFT', 'OPEN')
    and kind = 'COMPETITION'
  );

-- ------------------------------------------------------------------
-- 2) tournament_matches — paires réelles, jamais un score
-- ------------------------------------------------------------------
create table if not exists public.tournament_matches (
  id uuid not null default gen_random_uuid(),
  competition_id uuid not null,
  round integer not null,
  slot integer not null,
  club_a_id uuid not null,
  club_b_id uuid not null,
  status text not null default 'SCHEDULED',
  created_at timestamp(3) not null default current_timestamp,

  constraint tournament_matches_pkey primary key (id),
  constraint tournament_matches_competition_fkey
    foreign key (competition_id) references public.competitions(id) on delete cascade,
  constraint tournament_matches_club_a_fkey
    foreign key (club_a_id) references public.clubs(id) on delete cascade,
  constraint tournament_matches_club_b_fkey
    foreign key (club_b_id) references public.clubs(id) on delete cascade,
  constraint tournament_matches_round_check check (round >= 1),
  constraint tournament_matches_slot_check check (slot >= 0),
  constraint tournament_matches_status_check
    check (status in ('SCHEDULED', 'PLAYED')),
  constraint tournament_matches_clubs_distinct
    check (club_a_id is distinct from club_b_id),
  constraint tournament_matches_round_slot_unique unique (competition_id, round, slot)
);

create index if not exists tournament_matches_competition_id_idx
  on public.tournament_matches (competition_id);
create index if not exists tournament_matches_round_idx
  on public.tournament_matches (competition_id, round);

-- Paire non ordonnée unique par tour (A vs B = B vs A).
create unique index if not exists tournament_matches_round_pair_unique
  on public.tournament_matches (
    competition_id,
    round,
    least(club_a_id, club_b_id),
    greatest(club_a_id, club_b_id)
  );

grant select on public.tournament_matches to authenticated;
grant all privileges on public.tournament_matches to service_role;

alter table public.tournament_matches enable row level security;

create policy "tournament_matches_select_open_or_own" on public.tournament_matches
  for select to authenticated using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and (c.status = 'OPEN' or c.created_by = auth.uid())
    )
  );

-- ------------------------------------------------------------------
-- 3) Gardes INSERT : tournoi, clubs inscrits, statut SCHEDULED, ordre ids
-- ------------------------------------------------------------------
create or replace function public.tournament_matches_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_tmp uuid;
begin
  if new.status is distinct from 'SCHEDULED' then
    raise exception 'tournament_match_insert_scheduled_only';
  end if;

  if new.club_a_id is not distinct from new.club_b_id then
    raise exception 'tournament_match_same_club';
  end if;

  if new.club_a_id > new.club_b_id then
    v_tmp := new.club_a_id;
    new.club_a_id := new.club_b_id;
    new.club_b_id := v_tmp;
  end if;

  select kind into v_kind from public.competitions where id = new.competition_id;
  if v_kind is null then
    raise exception 'competition_not_found';
  end if;
  if v_kind is distinct from 'TOURNAMENT' then
    raise exception 'not_a_tournament';
  end if;

  if not exists (
    select 1 from public.competition_clubs
    where competition_id = new.competition_id and club_id = new.club_a_id
  ) or not exists (
    select 1 from public.competition_clubs
    where competition_id = new.competition_id and club_id = new.club_b_id
  ) then
    raise exception 'clubs_not_in_competition';
  end if;

  return new;
end;
$$;

drop trigger if exists tournament_matches_insert_guard on public.tournament_matches;
create trigger tournament_matches_insert_guard
  before insert on public.tournament_matches
  for each row
  execute function public.tournament_matches_insert_guard();

-- ------------------------------------------------------------------
-- 4) PLAYED seulement si un match_results lié existe pour la paire
-- ------------------------------------------------------------------
create or replace function public.tournament_matches_mark_played()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.competition_id is null or new.opponent_club_id is null then
    return new;
  end if;

  update public.tournament_matches
    set status = 'PLAYED'
    where competition_id = new.competition_id
      and status = 'SCHEDULED'
      and (
        (club_a_id = new.club_id and club_b_id = new.opponent_club_id)
        or (club_a_id = new.opponent_club_id and club_b_id = new.club_id)
      );

  return new;
end;
$$;

drop trigger if exists tournament_matches_mark_played on public.match_results;
create trigger tournament_matches_mark_played
  after insert or update of competition_id, opponent_club_id, club_id
  on public.match_results
  for each row
  execute function public.tournament_matches_mark_played();

-- ------------------------------------------------------------------
-- 5) Pool de clubs par tour — snapshot au tirage (pas les inscriptions tardives)
-- ------------------------------------------------------------------
create table if not exists public.tournament_round_clubs (
  id uuid not null default gen_random_uuid(),
  competition_id uuid not null,
  round integer not null,
  club_id uuid not null,
  created_at timestamp(3) not null default current_timestamp,

  constraint tournament_round_clubs_pkey primary key (id),
  constraint tournament_round_clubs_competition_fkey
    foreign key (competition_id) references public.competitions(id) on delete cascade,
  constraint tournament_round_clubs_club_fkey
    foreign key (club_id) references public.clubs(id) on delete cascade,
  constraint tournament_round_clubs_round_check check (round >= 1),
  constraint tournament_round_clubs_pair_unique unique (competition_id, round, club_id)
);

create index if not exists tournament_round_clubs_competition_id_idx
  on public.tournament_round_clubs (competition_id, round);

grant select on public.tournament_round_clubs to authenticated;
grant all privileges on public.tournament_round_clubs to service_role;

alter table public.tournament_round_clubs enable row level security;

create policy "tournament_round_clubs_select_open_or_own" on public.tournament_round_clubs
  for select to authenticated using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and (c.status = 'OPEN' or c.created_by = auth.uid())
    )
  );

create or replace function public.tournament_round_clubs_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  select kind into v_kind from public.competitions where id = new.competition_id;
  if v_kind is distinct from 'TOURNAMENT' then
    raise exception 'not_a_tournament';
  end if;
  if not exists (
    select 1 from public.competition_clubs
    where competition_id = new.competition_id and club_id = new.club_id
  ) then
    raise exception 'clubs_not_in_competition';
  end if;
  return new;
end;
$$;

drop trigger if exists tournament_round_clubs_insert_guard on public.tournament_round_clubs;
create trigger tournament_round_clubs_insert_guard
  before insert on public.tournament_round_clubs
  for each row
  execute function public.tournament_round_clubs_insert_guard();

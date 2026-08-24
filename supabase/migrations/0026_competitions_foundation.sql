-- ==============================================================================
-- ClubPro Connect — Compétitions virtuelles EA SPORTS FC 27 Pro Clubs (fondation).
-- À appliquer APRÈS 0025_safety_notifications.sql, via SQL Editor Supabase
-- (ou `supabase db push`) sur le projet distant.
--
-- Source distante : ce fichier (Option B). Miroir Prisma dans schema.prisma
-- uniquement — NE PAS double-appliquer via `prisma migrate deploy`.
-- L'agent n'applique PAS cette migration en production.
--
-- Portée de ce slice (et seulement ça) :
--   1) Table `competitions` — id, name, status DRAFT|OPEN|CLOSED, created_by,
--      timestamps. Pas de brackets, pas de saisons, pas de tournois.
--   2) Table `competition_clubs` — paire unique (competition_id, club_id).
--   3) RLS : lecture authenticated des compétitions OPEN ; le créateur lit
--      aussi les siennes (DRAFT/CLOSED) ; INSERT DRAFT/OPEN par le créateur
--      (created_by = auth.uid()) ; inscription OWNER/MANAGER du club sur une
--      compétition OPEN ; service_role full (Edge create-competition /
--      register-competition-club).
--
-- PAS de table standings / classements : `match_results` (0014) n'a ni
-- `competition_id` ni club adverse identifié — on ne peut pas remplir un
-- classement uniquement depuis les résultats existants sans inventer des
-- données. Le Match Result Engine reste le SEUL système de résultats
-- (aucun ALTER sur match_results / match_checkins).
--
-- Hors slice (volontaire, PAS commencé) : brackets, rankings, saisons,
-- tournois, mapping EA↔CPC.
-- ==============================================================================

-- ------------------------------------------------------------------
-- 1) Tables
-- ------------------------------------------------------------------
create table if not exists public.competitions (
  id uuid not null default gen_random_uuid(),
  name text not null,
  status text not null default 'DRAFT',
  created_by uuid not null,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,

  constraint competitions_pkey primary key (id),
  constraint competitions_created_by_fkey
    foreign key (created_by) references public.users(id) on delete cascade,
  constraint competitions_status_check
    check (status in ('DRAFT', 'OPEN', 'CLOSED')),
  constraint competitions_name_len
    check (char_length(btrim(name)) between 1 and 80)
);

create index if not exists competitions_status_idx on public.competitions (status);
create index if not exists competitions_created_by_idx on public.competitions (created_by);

create table if not exists public.competition_clubs (
  id uuid not null default gen_random_uuid(),
  competition_id uuid not null,
  club_id uuid not null,
  created_at timestamp(3) not null default current_timestamp,

  constraint competition_clubs_pkey primary key (id),
  constraint competition_clubs_competition_fkey
    foreign key (competition_id) references public.competitions(id) on delete cascade,
  constraint competition_clubs_club_fkey
    foreign key (club_id) references public.clubs(id) on delete cascade,
  -- Idempotence d'inscription : une seule ligne par paire. Doublon → 23505 → 409.
  constraint competition_clubs_pair_unique unique (competition_id, club_id)
);

create index if not exists competition_clubs_club_id_idx on public.competition_clubs (club_id);

-- ------------------------------------------------------------------
-- 2) Grants — explicites (default privileges 0006 suffisent en théorie ;
--    re-posés pour ne pas dépendre du owner de session SQL Editor).
--    UPDATE/DELETE authenticated : aucun besoin fondation, RLS default-deny.
-- ------------------------------------------------------------------
grant select, insert on public.competitions to authenticated;
grant select, insert on public.competition_clubs to authenticated;
grant all privileges on public.competitions to service_role;
grant all privileges on public.competition_clubs to service_role;

-- ------------------------------------------------------------------
-- 3) RLS
-- ------------------------------------------------------------------
alter table public.competitions enable row level security;
alter table public.competition_clubs enable row level security;

-- Lecture : toute session voit les compétitions OPEN. Le créateur voit aussi
-- ses DRAFT / CLOSED (nécessaire après INSERT DRAFT). Jamais anon.
create policy "competitions_select_open_or_own" on public.competitions
  for select to authenticated using (
    status = 'OPEN'
    or created_by = auth.uid()
  );

-- Création : créateur = JWT, statut DRAFT ou OPEN uniquement (CLOSED se pose
-- plus tard, hors slice — pas d'UPDATE authenticated ici).
create policy "competitions_insert_creator" on public.competitions
  for insert to authenticated with check (
    created_by = auth.uid()
    and status in ('DRAFT', 'OPEN')
  );

-- Clubs inscrits : visibles si la compétition est OPEN, ou si on en est le créateur.
create policy "competition_clubs_select_open_or_own" on public.competition_clubs
  for select to authenticated using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and (c.status = 'OPEN' or c.created_by = auth.uid())
    )
  );

-- Inscription : OWNER/MANAGER du club, compétition OPEN. Unique (pair) en DB.
create policy "competition_clubs_insert_manager" on public.competition_clubs
  for insert to authenticated with check (
    exists (
      select 1 from public.club_members m
      where m.club_id = club_id
        and m.user_id = auth.uid()
        and m.role in ('OWNER', 'MANAGER')
    )
    and exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and c.status = 'OPEN'
    )
  );

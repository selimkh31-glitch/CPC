-- ==============================================================================
-- ClubPro Connect — Import unofficial EA FC Pro Clubs (/api/fc) dans CPC.
-- À appliquer APRÈS 0029_tournaments_v1.sql, via SQL Editor Supabase
-- (ou `supabase db push`) sur le projet distant.
--
-- L'agent n'applique PAS cette migration en production.
--
-- Source : GET unofficial proclubs.ea.com/api/fc
--   search, clubs/info, clubs/overallStats, members/stats,
--   members/career/stats, clubs/matches (league|friendly|playoff).
-- Stocké comme import non vérifié. Identité joueur = playername
-- (users.ea_identity_kind USERNAME_EQUALITY), jamais une clé persona comme login.
-- Historique club = accumulation des matchs (EA ne renvoie que les N derniers).
-- Versionné par titre (`ea_title` = fc26 | fc27 | fcNN). Ledger produit CPC =
-- fc27, vide au jour 1 ; le live /api/fc actuel s'écrit sous EA_FC_TITLE
-- (défaut fc26) et n'est PAS copié dans fc27. Dedup matchs :
-- unique (ea_title, ea_club_id, platform, ea_match_id).
--
-- Miroir Prisma dans schema.prisma uniquement — NE PAS double-appliquer
-- via `prisma migrate deploy`.
-- ==============================================================================

create table if not exists public.ea_imported_clubs (
  ea_title text not null,
  ea_club_id text not null,
  platform text not null default 'common-gen5',
  name text,
  crest_id text,
  wins integer,
  losses integer,
  draws integer,
  titles_won integer,
  games_played integer,
  source text not null default 'unofficial_api_fc',
  unverified boolean not null default true,
  imported_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  constraint ea_imported_clubs_pkey primary key (ea_title, ea_club_id, platform),
  constraint ea_imported_clubs_title_check check (ea_title ~ '^fc[0-9]{2}$')
);

create table if not exists public.ea_imported_members (
  id uuid not null default gen_random_uuid(),
  ea_title text not null,
  ea_club_id text not null,
  platform text not null default 'common-gen5',
  playername text not null,
  pro_position text,
  pro_name text,
  games_played integer,
  goals integer,
  assists integer,
  rating_ave double precision,
  career_games_played integer,
  career_goals integer,
  career_assists integer,
  career_rating_ave double precision,
  career_pro_overall integer,
  source text not null default 'unofficial_api_fc',
  unverified boolean not null default true,
  imported_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  constraint ea_imported_members_pkey primary key (id),
  constraint ea_imported_members_identity unique (ea_title, ea_club_id, platform, playername),
  constraint ea_imported_members_title_check check (ea_title ~ '^fc[0-9]{2}$')
);

create index if not exists ea_imported_members_club_idx
  on public.ea_imported_members (ea_title, ea_club_id, platform);

create table if not exists public.ea_imported_matches (
  id uuid not null default gen_random_uuid(),
  ea_title text not null,
  ea_club_id text not null,
  ea_match_id text not null,
  platform text not null default 'common-gen5',
  match_type text not null,
  played_at text,
  players jsonb not null default '{}'::jsonb,
  source text not null default 'unofficial_api_fc',
  unverified boolean not null default true,
  imported_at timestamp(3) not null default current_timestamp,
  constraint ea_imported_matches_pkey primary key (id),
  constraint ea_imported_matches_identity unique (ea_title, ea_club_id, platform, ea_match_id),
  constraint ea_imported_matches_title_check check (ea_title ~ '^fc[0-9]{2}$')
);

create index if not exists ea_imported_matches_club_idx
  on public.ea_imported_matches (ea_title, ea_club_id, platform, imported_at desc);

alter table public.ea_imported_clubs enable row level security;
alter table public.ea_imported_members enable row level security;
alter table public.ea_imported_matches enable row level security;

-- Lecture authenticated (historique importé). Écriture = service_role seulement
-- (link-ea-club / ea-sync). Jamais d'écriture client, jamais anon.
create policy "ea_imported_clubs_select_authenticated"
  on public.ea_imported_clubs for select to authenticated using (true);
create policy "ea_imported_members_select_authenticated"
  on public.ea_imported_members for select to authenticated using (true);
create policy "ea_imported_matches_select_authenticated"
  on public.ea_imported_matches for select to authenticated using (true);

grant select on public.ea_imported_clubs to authenticated;
grant select on public.ea_imported_members to authenticated;
grant select on public.ea_imported_matches to authenticated;
grant all privileges on public.ea_imported_clubs to service_role;
grant all privileges on public.ea_imported_members to service_role;
grant all privileges on public.ea_imported_matches to service_role;

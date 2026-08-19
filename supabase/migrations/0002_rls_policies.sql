-- ==============================================================================
-- ClubPro Connect — Row Level Security
-- À exécuter APRÈS la migration Prisma (prisma/migrations/20260815000000_init)
-- et AVANT 0003_triggers.sql. Voir README.md > "Base de données & RLS".
--
-- Principe : les mutations sensibles/multi-étapes (candidater, répondre à une
-- candidature, review + recalcul de fiabilité, sync EA, IA) passent par des
-- Supabase Edge Functions (service_role, contournent RLS mais vérifient l'auth
-- applicative en code — voir supabase/functions/). Les mutations simples
-- (créer un club, toggle live, éditer son profil) passent directement par le
-- client mobile via supabase-js et SONT donc protégées par ces policies RLS.
--
-- Portée des lectures : l'app mobile exige une session pour tout écran
-- (voir app/_layout.tsx > Stack.Protected), il n'y a donc aucun besoin
-- fonctionnel de lecture anonyme. Toutes les policies de lecture "publiques
-- côté produit" (feed, annuaire, profils, reviews, classements) sont donc
-- restreintes au rôle `authenticated` — jamais à `anon` — plutôt que
-- littéralement publiques. Seules les données réellement privées (candidatures
-- d'un tiers, écriture de profil d'un tiers, push_token) restent en plus
-- restreintes par des règles métier (auth.uid(), rôle owner/manager).
-- ==============================================================================

alter table public.users enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_sessions enable row level security;
alter table public.applications enable row level security;
alter table public.reviews enable row level security;
alter table public.seasons enable row level security;
alter table public.season_stats enable row level security;

-- ------------------------------------------------------------------
-- users — profil visible par tout utilisateur connecté (ClubPro Card, feed,
-- candidatures), édition de son propre profil uniquement.
--
-- push_token n'est JAMAIS lisible via l'API publique (anon/authenticated),
-- même pas sur sa propre ligne en select("*") : c'est une donnée d'infra
-- (routage des notifications), pas une donnée de profil. Seules les Edge
-- Functions (service_role, jamais révoqué ici) doivent le lire pour émettre
-- des push. Toute lecture cliente doit donc lister ses colonnes explicitement
-- (voir lib/types.ts > USER_PUBLIC_COLUMNS) plutôt que select("*").
-- ------------------------------------------------------------------
create policy "users_select_authenticated" on public.users
  for select to authenticated using (true);

create policy "users_insert_self" on public.users
  for insert to authenticated with check (auth.uid() = id);

create policy "users_update_self" on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

revoke select (push_token) on public.users from anon, authenticated;

-- ------------------------------------------------------------------
-- clubs — visibles par tout utilisateur connecté, gérés par leur owner.
-- ------------------------------------------------------------------
create policy "clubs_select_authenticated" on public.clubs
  for select to authenticated using (true);

create policy "clubs_insert_owner" on public.clubs
  for insert to authenticated with check (auth.uid() = owner_id);

create policy "clubs_update_owner" on public.clubs
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "clubs_delete_owner" on public.clubs
  for delete to authenticated using (auth.uid() = owner_id);

-- ------------------------------------------------------------------
-- club_members — visibles par tout utilisateur connecté (annuaire, dashboard),
-- gérés par le owner du club. L'ajout du owner à la création d'un club est géré
-- par le trigger `on_club_created` (0003_triggers.sql), pas par une policy INSERT
-- côté client : le client ne fait donc jamais d'INSERT direct sur cette table.
-- ------------------------------------------------------------------
create policy "club_members_select_authenticated" on public.club_members
  for select to authenticated using (true);

create policy "club_members_write_owner" on public.club_members
  for all to authenticated using (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid())
  );

-- ------------------------------------------------------------------
-- club_sessions — visibles par tout utilisateur connecté (feed live), gérées
-- par owner/manager du club. `updated_at` est maintenu par le trigger
-- `handle_updated_at` (0003_triggers.sql), jamais fourni par le client.
-- ------------------------------------------------------------------
create policy "club_sessions_select_authenticated" on public.club_sessions
  for select to authenticated using (true);

create policy "club_sessions_write_manager" on public.club_sessions
  for all to authenticated using (
    exists (
      select 1 from public.club_members m
      where m.club_id = club_sessions.club_id
        and m.user_id = auth.uid()
        and m.role in ('OWNER', 'MANAGER')
    )
  ) with check (
    exists (
      select 1 from public.club_members m
      where m.club_id = club_sessions.club_id
        and m.user_id = auth.uid()
        and m.role in ('OWNER', 'MANAGER')
    )
  );

-- ------------------------------------------------------------------
-- applications — privées : visibles par le candidat et le club concerné
-- uniquement (jamais par un tiers). Écriture réelle via l'Edge Function
-- `apply` (service_role) ; ces policies restent en défense en profondeur.
-- ------------------------------------------------------------------
create policy "applications_select_involved" on public.applications
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.club_members m
      where m.club_id = applications.club_id and m.user_id = auth.uid() and m.role in ('OWNER', 'MANAGER')
    )
  );

create policy "applications_insert_self" on public.applications
  for insert to authenticated with check (auth.uid() = user_id);

create policy "applications_update_manager" on public.applications
  for update to authenticated using (
    exists (
      select 1 from public.club_members m
      where m.club_id = applications.club_id and m.user_id = auth.uid() and m.role in ('OWNER', 'MANAGER')
    )
  );

-- ------------------------------------------------------------------
-- reviews — visibles par tout utilisateur connecté (affichées sur la ClubPro
-- Card), écrites par leur auteur. Écriture réelle via l'Edge Function
-- `submit-review` (service_role) ; cette policy reste en défense en profondeur.
-- ------------------------------------------------------------------
create policy "reviews_select_authenticated" on public.reviews
  for select to authenticated using (true);

create policy "reviews_insert_self" on public.reviews
  for insert to authenticated with check (auth.uid() = reviewer_id and auth.uid() <> target_user_id);

-- ------------------------------------------------------------------
-- seasons / season_stats — visibles par tout utilisateur connecté (classements),
-- écriture réservée au service_role (jobs cron `ea-sync` / `season-ranking`).
-- ------------------------------------------------------------------
create policy "seasons_select_authenticated" on public.seasons
  for select to authenticated using (true);

create policy "season_stats_select_authenticated" on public.season_stats
  for select to authenticated using (true);

-- Aucune policy INSERT/UPDATE authenticated sur seasons/season_stats :
-- seul le service_role (jobs cron, qui contourne RLS) peut écrire.

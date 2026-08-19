-- ==============================================================================
-- ClubPro Connect — Correction des privilèges manquants sur le schéma public.
--
-- Cause (audit lecture-seule effectué avant cette migration) : les projets
-- Supabase récents ne pré-provisionnent plus automatiquement USAGE/grants sur
-- `public` (contrairement aux schémas gérés par la plateforme : auth, storage,
-- extensions, graphql, graphql_public, realtime, qui ont bien leurs propres
-- default privileges). Aucune migration CPC — ni la migration Prisma initiale,
-- ni 0001-0005 — n'a jamais posé ce GRANT initial : gap présent depuis le
-- début, pas une régression, pas un retrait explicite. Résultat : RLS
-- correctement écrites (0002/0005) mais jamais atteignables, car le blocage
-- `permission denied for schema public` (42501) intervient avant toute
-- évaluation RLS.
--
-- `anon` reste volontairement exclu de tout ce fichier (USAGE, grants tables,
-- default privileges) — aucun écran de l'app n'est accessible sans session,
-- voir le principe déjà documenté dans 0002_rls_policies.sql.
-- ==============================================================================

-- ------------------------------------------------------------------
-- SCHEMA
-- ------------------------------------------------------------------
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

-- ------------------------------------------------------------------
-- TABLES — authenticated (RLS filtre déjà lignes/colonnes par-dessus)
-- ------------------------------------------------------------------
grant select, insert, update, delete on public.clubs to authenticated;
grant select, insert, update, delete on public.club_members to authenticated;
grant select, insert, update, delete on public.club_sessions to authenticated;
grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant select, insert, update, delete on public.seasons to authenticated;
grant select, insert, update, delete on public.season_stats to authenticated;

-- `users` : INSERT/UPDATE de la ligne complète restent nécessaires (RLS limite
-- déjà à sa propre ligne), mais le SELECT DOIT rester colonne-par-colonne pour
-- ne jamais exposer push_token — un `grant select on public.users` générique
-- écraserait silencieusement cette restriction (piège déjà rencontré et
-- documenté dans 0004_fix_push_token_grant.sql). Donc : INSERT/UPDATE larges,
-- SELECT explicitement RE-POSÉ par colonnes juste après, jamais élargi.
grant insert, update on public.users to authenticated;

revoke select on public.users from authenticated;
grant select (
  id, username, platform, main_position, secondary_positions, play_style, languages,
  availability, reliability_score, verified_stats, ea_club_linked, plan, current_streak,
  best_streak, badges, applications_today, applications_reset_at, created_at
) on public.users to authenticated;

-- ------------------------------------------------------------------
-- TABLES — service_role (accès complet nécessaire aux Edge Functions,
-- push_token inclus : c'est le seul rôle censé le lire/écrire)
-- ------------------------------------------------------------------
grant all privileges on public.users to service_role;
grant all privileges on public.clubs to service_role;
grant all privileges on public.club_members to service_role;
grant all privileges on public.club_sessions to service_role;
grant all privileges on public.applications to service_role;
grant all privileges on public.reviews to service_role;
grant all privileges on public.seasons to service_role;
grant all privileges on public.season_stats to service_role;

-- ------------------------------------------------------------------
-- RPC — accept_application : aucune modification. Les grants function-level
-- de 0005_live_workflow.sql (EXECUTE service_role uniquement, explicitement
-- révoqué pour anon/authenticated) sont indépendants des grants table-level
-- ci-dessus (deux systèmes de privilèges distincts en Postgres) et restent
-- donc inchangés par cette migration. Vérifié après application (voir rapport).
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- DEFAULT PRIVILEGES — pour que les prochaines tables créées par le
-- propriétaire actuel des migrations (postgres) héritent automatiquement des
-- bons droits, sans reproduire ce gap à chaque nouvelle table. anon exclu.
-- ------------------------------------------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant all privileges on tables to service_role;

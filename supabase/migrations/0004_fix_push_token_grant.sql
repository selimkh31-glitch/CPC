-- ==============================================================================
-- ClubPro Connect — correctif : push_token toujours lisible par anon/authenticated
-- malgré le `revoke select (push_token) ...` de 0002_rls_policies.sql.
--
-- Cause : Supabase pose par défaut un GRANT ALL au niveau TABLE sur toute
-- nouvelle table de `public` pour anon/authenticated/service_role. Un REVOKE
-- ciblé sur une seule colonne ne retire rien tant qu'un GRANT plus large
-- (table entière) subsiste : en Postgres, il faut d'abord révoquer le
-- privilège large, puis re-accorder explicitement la liste de colonnes
-- autorisées. Confirmé par test réel : `has_column_privilege('authenticated',
-- 'public.users', 'push_token', 'SELECT')` renvoyait `true` après 0002.
--
-- La liste de colonnes ci-dessous doit rester synchronisée avec
-- `USER_PUBLIC_COLUMNS` dans lib/types.ts.
-- ==============================================================================

revoke select on public.users from anon, authenticated;

grant select (
  id, username, platform, main_position, secondary_positions, play_style, languages,
  availability, reliability_score, verified_stats, ea_club_linked, plan, current_streak,
  best_streak, badges, applications_today, applications_reset_at, created_at
) on public.users to anon, authenticated;

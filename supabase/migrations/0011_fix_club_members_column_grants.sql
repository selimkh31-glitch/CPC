-- ==============================================================================
-- ClubPro Connect — Phase 5 : correctif du durcissement des colonnes sensibles
-- de club_members posé dans 0010_engagement_model.sql.
--
-- Cause (même piège déjà rencontré et documenté dans
-- 0004_fix_push_token_grant.sql) : 0010 faisait un
-- `revoke update (matches_played_count, strike_count, active_departure_request_id)
-- on club_members from authenticated`, mais ce revoke COLONNE ne retire rien
-- tant qu'un GRANT plus large (UPDATE sur la table entière, posé par
-- 0006_fix_schema_grants.sql : `grant select, insert, update, delete on
-- public.club_members to authenticated`) subsiste. Confirmé par vérification
-- réelle post-migration : authenticated conservait UPDATE sur les 3 colonnes.
--
-- Remède identique à 0004 : révoquer le privilège UPDATE large au niveau
-- table, puis le ré-accorder explicitement colonne par colonne pour la seule
-- colonne que l'owner doit pouvoir modifier directement (role — promotion/
-- rétrogradation MEMBER<->MANAGER, MembersPanel/useUpdateMember, comportement
-- inchangé). matches_played_count/strike_count/active_departure_request_id
-- restent donc réellement non modifiables par authenticated après ce fichier.
-- ==============================================================================

revoke update on public.club_members from authenticated;

grant update (role) on public.club_members to authenticated;

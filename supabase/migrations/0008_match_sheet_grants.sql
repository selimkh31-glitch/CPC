-- ==============================================================================
-- ClubPro Connect — grants table-level manquants sur invitations/slot_assignments.
--
-- Cause : ces deux tables ont été créées (0007 + migration Prisma phase 2)
-- AVANT que la restauration post-incident ne rétablisse les
-- `ALTER DEFAULT PRIVILEGES` de 0006 — les default privileges ne s'appliquent
-- qu'aux tables créées APRÈS leur pose, jamais rétroactivement. RLS et
-- policies (0007) sont correctes et intactes ; seuls les grants table-level
-- manquaient, vérifié par audit direct (has_table_privilege = false partout).
--
-- Même principe que 0006 : anon exclu, authenticated en lecture/écriture
-- filtrée par RLS, service_role en accès complet.
-- ==============================================================================

grant select, insert, update, delete on public.invitations to authenticated;
grant select, insert, update, delete on public.slot_assignments to authenticated;

grant all privileges on public.invitations to service_role;
grant all privileges on public.slot_assignments to service_role;

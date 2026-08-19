-- ==============================================================================
-- ClubPro Connect — Phase 5 : Contrat d'effectif (engagement, départs,
-- transitions, check-in match). À exécuter APRÈS la migration Prisma
-- 20260817140455_engagement_model (tables club_departures/match_checkins/
-- match_participations, colonnes club_members/invitations, enum RESERVED).
--
-- Portée de ce fichier : RLS + contraintes + grants uniquement. Aucune
-- fonction SECURITY DEFINER métier ici (request-departure, respond-departure,
-- launch-match-checkin, etc.) — explicitement réservé à la Phase 2 (backend),
-- après validation séparée.
-- ==============================================================================

alter table public.club_departures enable row level security;
alter table public.match_checkins enable row level security;
alter table public.match_participations enable row level security;

-- ------------------------------------------------------------------
-- club_departures — visible par le joueur concerné et le owner/manager du
-- club concerné, comme applications/invitations. AUCUNE policy INSERT/UPDATE
-- pour authenticated (décision produit explicite) : la création d'une
-- demande passe exclusivement par l'Edge Function request-departure
-- (Phase 2), qui seule vérifie l'éligibilité serveur (membership actif,
-- rôle MEMBER/MANAGER, >=1 match joué, pas de demande active, pas de
-- transition incompatible) avant d'écrire via service_role. Toute
-- transition de statut (accepter/refuser/expirer/force exit/libération
-- owner) passe de la même façon par une fonction SECURITY DEFINER dédiée.
-- Le grant table-level INSERT/UPDATE qu'hérite automatiquement cette table
-- via les default privileges (0006_fix_schema_grants.sql) reste donc inerte
-- pour authenticated : sans policy, RLS refuse toute écriture cliente.
-- ------------------------------------------------------------------
create policy "club_departures_select_involved" on public.club_departures
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.club_members m
      where m.club_id = club_departures.club_id and m.user_id = auth.uid()
        and m.role in ('OWNER', 'MANAGER')
    )
  );

-- ------------------------------------------------------------------
-- match_checkins / match_participations — lecture publique-authentifiée,
-- cohérent avec slot_assignments/club_sessions déjà ouverts ainsi (annuaire
-- transparent). Aucune policy d'écriture pour authenticated : la création
-- d'un check-in (+ ses participations, + libération des slots absents, +
-- incrément matches_played_count, + finalisation des départs/transitions
-- dus) est une séquence atomique multi-tables réservée à la fonction
-- launch-match-checkin (Phase 2, service_role) — même raisonnement que
-- accept_application/accept_invitation existants.
-- ------------------------------------------------------------------
create policy "match_checkins_select_authenticated" on public.match_checkins
  for select to authenticated using (true);

create policy "match_participations_select_authenticated" on public.match_participations
  for select to authenticated using (true);

-- ------------------------------------------------------------------
-- Protection contre la multi-appartenance MEMBER/MANAGER (règle fondamentale
-- de la Phase 5). Index unique PARTIEL — non exprimable dans le DSL Prisma,
-- même traitement que club_sessions_one_live_per_club (0005_live_workflow.sql).
--
-- Portée volontairement limitée aux rôles MEMBER et MANAGER : un OWNER reste
-- totalement libre de posséder plusieurs clubs (hors du champ de cet index
-- via la clause WHERE), conformément à l'exception explicitement validée.
-- Le trigger on_club_created (0003_triggers.sql) insère toujours role='OWNER'
-- à la création d'un club — non affecté par cet index. Une promotion/
-- rétrogradation MEMBER<->MANAGER (useUpdateMember) est un UPDATE sur la
-- ligne existante, pas un INSERT — non affecté non plus.
--
-- Audit réalisé avant application (lecture seule, voir rapport) : 0 ligne
-- existante en violation — migration applicable sans backfill.
-- ------------------------------------------------------------------
create unique index club_members_one_active_role_per_user
  on public.club_members (user_id)
  where role in ('MEMBER', 'MANAGER');

-- ------------------------------------------------------------------
-- Anti-double-revendication d'un joueur en transition (section K de l'audit
-- Phase 4.5/spec précédente) : une seule invitation de transition PENDING à
-- la fois par demande de départ, tous clubs confondus. La finalisation
-- atomique (RPC dédiée, Phase 2) devra annuler toute invitation transition
-- concurrente restée PENDING avant de passer la sienne en RESERVED.
-- ------------------------------------------------------------------
create unique index invitations_one_pending_transition_per_departure
  on public.invitations (departure_request_id)
  where status = 'PENDING' and departure_request_id is not null;

-- ------------------------------------------------------------------
-- Index ciblé pour le futur sweep cron (resolve-expired-departures, Phase 2)
-- — ne scanne que les demandes réellement en attente.
-- ------------------------------------------------------------------
create index club_departures_pending_expiry
  on public.club_departures (expires_at)
  where status = 'PENDING';

-- ------------------------------------------------------------------
-- Durcissement des colonnes sensibles de club_members. CRITIQUE : la policy
-- existante club_members_write_owner (0002_rls_policies.sql) est déclarée
-- `for all` et ne restreint AUCUNE colonne — elle autorise déjà l'owner à
-- modifier n'importe quelle colonne de sa ligne, y compris ces 3 nouvelles.
-- Sans ce revoke, un owner pourrait manipuler strike_count/
-- active_departure_request_id par un appel supabase-js brut, hors de toute
-- UI, cassant la garantie "un owner ne peut jamais bloquer indéfiniment un
-- départ". Même technique déjà utilisée pour push_token (0002/0004) : un
-- REVOKE ciblé par colonne, superposé à un GRANT table plus large.
--
-- `role` reste volontairement hors de ce revoke : la promotion/rétrogradation
-- MEMBER<->MANAGER par l'owner (MembersPanel, useUpdateMember) doit continuer
-- à fonctionner sans changement.
-- ------------------------------------------------------------------
revoke update (matches_played_count, strike_count, active_departure_request_id)
  on public.club_members from authenticated;

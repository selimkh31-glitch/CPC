-- ==============================================================================
-- ClubPro Connect — Social Foundations : schéma DDL (mission "EA DATA
-- FOUNDATION + SOCIAL + COMPETITIONS + PLAYER CARDS + HARDENING", sections
-- 11-12). Enums + tables + indexes + FK pour le Chat et les Groupes sociaux.
-- Aucune RLS/policy/fonction/trigger ici — voir 0017_chat_rls.sql et
-- 0018_group_rls.sql, qui doivent s'exécuter APRÈS ce fichier.
--
-- Origine : ce DDL a d'abord été écrit comme migration Prisma
-- (prisma/migrations/20260820000000_social_foundations/migration.sql,
-- CONSERVÉE TELLE QUELLE, non supprimée, non appliquée au distant). Ce
-- fichier en est la transcription fidèle vers supabase/migrations/, pour que
-- ce dossier redevienne la source complète et autosuffisante appliquée au
-- projet distant — même principe que le schéma applicatif d'origine (voir
-- 0001_init_note.sql : Prisma crée les tables, supabase/migrations/ pose
-- RLS/triggers/grants par-dessus). Les deux fichiers DOIVENT rester en sync
-- si le modèle évolue ; `prisma/schema.prisma` reste la référence de
-- typage/génération Prisma côté outillage, mais n'est plus la source
-- appliquée au projet distant pour ces 5 tables — supabase/migrations/ l'est.
--
-- Aucune donnée existante affectée : 5 tables entièrement nouvelles, aucun
-- ALTER sur une table préexistante (users/clubs/club_members/...).
-- ==============================================================================

-- ------------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------------
create type "ConversationType" as enum ('DIRECT', 'GROUP', 'CLUB');
create type "ConversationRole" as enum ('OWNER', 'ADMIN', 'MEMBER');
create type "GroupVisibility" as enum ('PUBLIC', 'PRIVATE');
create type "GroupRole" as enum ('OWNER', 'ADMIN', 'MEMBER');

-- ------------------------------------------------------------------
-- conversations — abstraction commune DIRECT (1:1) / GROUP / CLUB (mission
-- section 11 : jamais un système séparé par type). `club_id`/`group_id`
-- non nuls uniquement pour leur type respectif — index uniques partiels
-- posés plus bas (non exprimables en Prisma, même doctrine que
-- invitations_one_pending_per_club_user, 0015).
-- ------------------------------------------------------------------
create table "conversations" (
    "id" uuid not null default gen_random_uuid(),
    "type" "ConversationType" not null,
    "club_id" uuid,
    "group_id" uuid,
    "created_by" uuid not null,
    "created_at" timestamp(3) not null default current_timestamp,

    constraint "conversations_pkey" primary key ("id")
);

create table "conversation_members" (
    "id" uuid not null default gen_random_uuid(),
    "conversation_id" uuid not null,
    "user_id" uuid not null,
    "role" "ConversationRole" not null default 'MEMBER',
    "joined_at" timestamp(3) not null default current_timestamp,
    "last_read_at" timestamp(3),

    constraint "conversation_members_pkey" primary key ("id")
);

create table "messages" (
    "id" uuid not null default gen_random_uuid(),
    "conversation_id" uuid not null,
    "sender_id" uuid not null,
    "body" text not null,
    "created_at" timestamp(3) not null default current_timestamp,
    "edited_at" timestamp(3),
    "deleted_at" timestamp(3),

    constraint "messages_pkey" primary key ("id")
);

-- ------------------------------------------------------------------
-- groups — distinct d'un club (mission section 12 : identité sociale, pas
-- compétitive/EA). `visibility` par défaut PRIVATE (donnée privée par
-- défaut, jamais l'inverse).
-- ------------------------------------------------------------------
create table "groups" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "avatar_url" text,
    "owner_id" uuid not null,
    "visibility" "GroupVisibility" not null default 'PRIVATE',
    "created_at" timestamp(3) not null default current_timestamp,

    constraint "groups_pkey" primary key ("id")
);

create table "group_members" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "user_id" uuid not null,
    "role" "GroupRole" not null default 'MEMBER',
    "joined_at" timestamp(3) not null default current_timestamp,

    constraint "group_members_pkey" primary key ("id")
);

-- ------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------
create unique index "conversation_members_conversation_id_user_id_key" on "conversation_members"("conversation_id", "user_id");
create index "conversation_members_user_id_idx" on "conversation_members"("user_id");
create index "messages_conversation_id_created_at_idx" on "messages"("conversation_id", "created_at");
create index "groups_owner_id_idx" on "groups"("owner_id");
create unique index "group_members_group_id_user_id_key" on "group_members"("group_id", "user_id");
create index "group_members_user_id_idx" on "group_members"("user_id");

-- Une seule conversation CLUB par club, resp. GROUP par groupe — index
-- uniques PARTIELS, non exprimables en Prisma (même pattern que
-- club_sessions_one_live_per_club, 0005, et invitations_one_pending_per_club_user, 0015).
create unique index "conversations_one_club_conversation" on "conversations"("club_id") where "type" = 'CLUB';
create unique index "conversations_one_group_conversation" on "conversations"("group_id") where "type" = 'GROUP';

-- ------------------------------------------------------------------
-- Foreign keys — toutes ON DELETE CASCADE ON UPDATE CASCADE, cohérent avec
-- le reste du schéma (club_members, applications, invitations, etc.).
-- ------------------------------------------------------------------
alter table "conversations" add constraint "conversations_club_id_fkey" foreign key ("club_id") references "clubs"("id") on delete cascade on update cascade;
alter table "conversations" add constraint "conversations_group_id_fkey" foreign key ("group_id") references "groups"("id") on delete cascade on update cascade;
alter table "conversations" add constraint "conversations_created_by_fkey" foreign key ("created_by") references "users"("id") on delete cascade on update cascade;
alter table "conversation_members" add constraint "conversation_members_conversation_id_fkey" foreign key ("conversation_id") references "conversations"("id") on delete cascade on update cascade;
alter table "conversation_members" add constraint "conversation_members_user_id_fkey" foreign key ("user_id") references "users"("id") on delete cascade on update cascade;
alter table "messages" add constraint "messages_conversation_id_fkey" foreign key ("conversation_id") references "conversations"("id") on delete cascade on update cascade;
alter table "messages" add constraint "messages_sender_id_fkey" foreign key ("sender_id") references "users"("id") on delete cascade on update cascade;
alter table "groups" add constraint "groups_owner_id_fkey" foreign key ("owner_id") references "users"("id") on delete cascade on update cascade;
alter table "group_members" add constraint "group_members_group_id_fkey" foreign key ("group_id") references "groups"("id") on delete cascade on update cascade;
alter table "group_members" add constraint "group_members_user_id_fkey" foreign key ("user_id") references "users"("id") on delete cascade on update cascade;

-- ------------------------------------------------------------------
-- Grants — aucun explicite ici. Les 5 tables héritent automatiquement des
-- default privileges posés dans 0006_fix_schema_grants.sql
-- (`alter default privileges in schema public grant select,insert,update,delete
-- on tables to authenticated` / `... all privileges ... to service_role`),
-- même mécanisme déjà utilisé sans exception pour toutes les tables créées
-- depuis 0007 (slot_assignments, invitations, club_departures,
-- match_checkins, match_participations, match_results — aucune n'a jamais
-- re-déclaré ses propres grants table-level). 0017_chat_rls.sql restreint
-- ensuite explicitement `role` (conversation_members) et les colonnes
-- éditables de `messages` par revoke/grant colonne — jamais dans ce fichier.
-- ------------------------------------------------------------------

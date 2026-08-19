-- ClubPro Connect — migration initiale, générée depuis prisma/schema.prisma
-- (`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`).
-- À appliquer avant supabase/migrations/0002_rls_policies.sql et 0003_triggers.sql.

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('PS', 'XBOX', 'PC');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST');

-- CreateEnum
CREATE TYPE "PlayStyle" AS ENUM ('ATTACKING', 'DEFENSIVE', 'BALANCED', 'PLAYMAKER', 'POACHER', 'ENFORCER');

-- CreateEnum
CREATE TYPE "ClubLevel" AS ENUM ('CASUAL', 'COMPETITIVE');

-- CreateEnum
CREATE TYPE "ClubRole" AS ENUM ('OWNER', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "main_position" "Position" NOT NULL,
    "secondary_positions" "Position"[],
    "play_style" "PlayStyle" NOT NULL,
    "languages" TEXT[],
    "availability" JSONB NOT NULL DEFAULT '{}',
    "reliability_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verified_stats" JSONB,
    "ea_club_linked" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "best_streak" INTEGER NOT NULL DEFAULT 0,
    "badges" JSONB NOT NULL DEFAULT '[]',
    "applications_today" INTEGER NOT NULL DEFAULT 0,
    "applications_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "push_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "level" "ClubLevel" NOT NULL DEFAULT 'CASUAL',
    "description" TEXT,
    "languages" TEXT[],
    "ea_club_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ClubRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "needed_positions" "Position"[],
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reviewer_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "rating_skill" INTEGER NOT NULL,
    "rating_behavior" INTEGER NOT NULL,
    "showed_up" BOOLEAN NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "season_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "clean_sheets" INTEGER NOT NULL DEFAULT 0,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "mvp_count" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "division" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_reliability_score_idx" ON "users"("reliability_score");

-- CreateIndex
CREATE INDEX "users_platform_idx" ON "users"("platform");

-- CreateIndex
CREATE INDEX "clubs_owner_id_idx" ON "clubs"("owner_id");

-- CreateIndex
CREATE INDEX "clubs_level_idx" ON "clubs"("level");

-- CreateIndex
CREATE INDEX "club_members_user_id_idx" ON "club_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "club_members_club_id_user_id_key" ON "club_members"("club_id", "user_id");

-- CreateIndex
CREATE INDEX "club_sessions_is_live_idx" ON "club_sessions"("is_live");

-- CreateIndex
CREATE INDEX "club_sessions_club_id_idx" ON "club_sessions"("club_id");

-- CreateIndex
CREATE INDEX "applications_club_id_status_idx" ON "applications"("club_id", "status");

-- CreateIndex
CREATE INDEX "applications_session_id_idx" ON "applications"("session_id");

-- CreateIndex
CREATE INDEX "applications_user_id_idx" ON "applications"("user_id");

-- CreateIndex
CREATE INDEX "reviews_target_user_id_idx" ON "reviews"("target_user_id");

-- CreateIndex
CREATE INDEX "season_stats_season_id_points_idx" ON "season_stats"("season_id", "points");

-- CreateIndex
CREATE INDEX "season_stats_season_id_division_idx" ON "season_stats"("season_id", "division");

-- CreateIndex
CREATE UNIQUE INDEX "season_stats_season_id_user_id_key" ON "season_stats"("season_id", "user_id");

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_sessions" ADD CONSTRAINT "club_sessions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "club_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_stats" ADD CONSTRAINT "season_stats_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_stats" ADD CONSTRAINT "season_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


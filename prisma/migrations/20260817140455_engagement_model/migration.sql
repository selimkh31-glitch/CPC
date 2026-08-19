-- CreateEnum
CREATE TYPE "DepartureStatus" AS ENUM ('PENDING', 'ACCEPTED_NOW', 'ACCEPTED_NEXT_MATCH', 'REFUSED', 'EXPIRED', 'FORCE_EXIT', 'OWNER_RELEASED');

-- CreateEnum
CREATE TYPE "DepartureInitiator" AS ENUM ('PLAYER', 'OWNER');

-- CreateEnum
CREATE TYPE "MatchParticipationStatus" AS ENUM ('PRESENT', 'ABSENT');

-- AlterEnum
ALTER TYPE "InvitationStatus" ADD VALUE 'RESERVED';

-- AlterTable
ALTER TABLE "club_members" ADD COLUMN     "active_departure_request_id" UUID,
ADD COLUMN     "matches_played_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "strike_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "departure_request_id" UUID;

-- CreateTable
CREATE TABLE "club_departures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "DepartureStatus" NOT NULL DEFAULT 'PENDING',
    "initiated_by" "DepartureInitiator" NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "responded_by" UUID,
    "release_match_checkin_id" UUID,
    "transition_invitation_id" UUID,
    "transition_target_club_id" UUID,

    CONSTRAINT "club_departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_checkins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "formation_id" TEXT,
    "launched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launched_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_checkin_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "slot_id" TEXT,
    "status" "MatchParticipationStatus" NOT NULL,

    CONSTRAINT "match_participations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "club_departures_user_id_idx" ON "club_departures"("user_id");

-- CreateIndex
CREATE INDEX "club_departures_club_id_status_idx" ON "club_departures"("club_id", "status");

-- CreateIndex
CREATE INDEX "match_checkins_club_id_idx" ON "match_checkins"("club_id");

-- CreateIndex
CREATE INDEX "match_participations_user_id_idx" ON "match_participations"("user_id");

-- CreateIndex
CREATE INDEX "match_participations_club_id_status_idx" ON "match_participations"("club_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "match_participations_match_checkin_id_user_id_key" ON "match_participations"("match_checkin_id", "user_id");

-- AddForeignKey
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_active_departure_request_id_fkey" FOREIGN KEY ("active_departure_request_id") REFERENCES "club_departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_departure_request_id_fkey" FOREIGN KEY ("departure_request_id") REFERENCES "club_departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_departures" ADD CONSTRAINT "club_departures_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_departures" ADD CONSTRAINT "club_departures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_departures" ADD CONSTRAINT "club_departures_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_departures" ADD CONSTRAINT "club_departures_release_match_checkin_id_fkey" FOREIGN KEY ("release_match_checkin_id") REFERENCES "match_checkins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_departures" ADD CONSTRAINT "club_departures_transition_invitation_id_fkey" FOREIGN KEY ("transition_invitation_id") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_departures" ADD CONSTRAINT "club_departures_transition_target_club_id_fkey" FOREIGN KEY ("transition_target_club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_checkins" ADD CONSTRAINT "match_checkins_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_checkins" ADD CONSTRAINT "match_checkins_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "club_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_checkins" ADD CONSTRAINT "match_checkins_launched_by_fkey" FOREIGN KEY ("launched_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participations" ADD CONSTRAINT "match_participations_match_checkin_id_fkey" FOREIGN KEY ("match_checkin_id") REFERENCES "match_checkins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participations" ADD CONSTRAINT "match_participations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participations" ADD CONSTRAINT "match_participations_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

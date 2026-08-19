-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "slot_id" TEXT;

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "formation" TEXT,
ADD COLUMN     "voice_link" TEXT;

-- CreateTable
CREATE TABLE "slot_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "slot_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "slot_id" TEXT,
    "user_id" UUID NOT NULL,
    "invited_by" UUID NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slot_assignments_club_id_slot_id_key" ON "slot_assignments"("club_id", "slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "slot_assignments_club_id_user_id_key" ON "slot_assignments"("club_id", "user_id");

-- CreateIndex
CREATE INDEX "invitations_club_id_status_idx" ON "invitations"("club_id", "status");

-- CreateIndex
CREATE INDEX "invitations_user_id_status_idx" ON "invitations"("user_id", "status");

-- AddForeignKey
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_assignments" ADD CONSTRAINT "slot_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


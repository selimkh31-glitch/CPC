-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "position" "Position" NOT NULL;

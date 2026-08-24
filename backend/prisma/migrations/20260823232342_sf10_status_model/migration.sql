-- CreateEnum
CREATE TYPE "Sf10Status" AS ENUM ('attach', 'available', 'released');

-- AlterTable
ALTER TABLE "Sf10Record" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "status" "Sf10Status" NOT NULL DEFAULT 'attach';

-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN     "handledGradeLevels" "GradeLevel"[];

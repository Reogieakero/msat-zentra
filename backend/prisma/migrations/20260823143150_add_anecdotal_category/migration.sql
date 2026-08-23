-- CreateEnum
CREATE TYPE "AnecdotalCategory" AS ENUM ('behavioral', 'bullying', 'academic', 'attendance', 'health');

-- AlterTable
ALTER TABLE "AnecdotalRecord" ADD COLUMN     "category" "AnecdotalCategory" NOT NULL DEFAULT 'behavioral';

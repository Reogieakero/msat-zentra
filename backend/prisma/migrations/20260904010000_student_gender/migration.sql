-- Student gender for advisory/teaching surfaces (nullable: existing rows
-- backfilled separately; new seeds set it explicitly).
ALTER TABLE "StudentProfile" ADD COLUMN "gender" TEXT;

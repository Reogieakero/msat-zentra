-- Token codes for the teacher-name catalog (visible wherever names are
-- listed). Nullable + unique: rows predating codes stay valid, and Postgres
-- treats NULLs as distinct. Backfills the seeded names; app code mints codes
-- for names created afterwards.
ALTER TABLE "TeacherName" ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "TeacherName_code_key" ON "TeacherName"("code");

UPDATE "TeacherName" SET "code" = 'MS-101' WHERE name = 'Maria Santos' AND "code" IS NULL;
UPDATE "TeacherName" SET "code" = 'JC-102' WHERE name = 'Jose Cruz' AND "code" IS NULL;
UPDATE "TeacherName" SET "code" = 'AR-103' WHERE name = 'Ana Reyes' AND "code" IS NULL;
UPDATE "TeacherName" SET "code" = 'MA-104' WHERE name = 'Mark Aquino' AND "code" IS NULL;
UPDATE "TeacherName" SET "code" = 'LR-105' WHERE name = 'Liza Ramos' AND "code" IS NULL;
UPDATE "TeacherName" SET "code" = 'PG-106' WHERE name = 'Paul Garcia' AND "code" IS NULL;
UPDATE "TeacherName" SET "code" = 'RD-107' WHERE name = 'Rosa Diaz' AND "code" IS NULL;
UPDATE "TeacherName" SET "code" = 'CM-108' WHERE name = 'Carlos Mendoza' AND "code" IS NULL;
UPDATE "TeacherName" SET "code" = 'JL-109' WHERE name = 'Jenny Lim' AND "code" IS NULL;
UPDATE "TeacherName" SET "code" = 'RT-110' WHERE name = 'Robert Torres' AND "code" IS NULL;

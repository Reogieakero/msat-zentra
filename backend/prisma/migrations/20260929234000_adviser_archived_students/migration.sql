-- Adviser-scoped soft delete for advisory students (records untouched)
CREATE TABLE "AdviserArchivedStudent" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT,
    "rosterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdviserArchivedStudent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdviserArchivedStudent_teacherId_studentId_key" ON "AdviserArchivedStudent"("teacherId", "studentId");
CREATE UNIQUE INDEX "AdviserArchivedStudent_teacherId_rosterId_key" ON "AdviserArchivedStudent"("teacherId", "rosterId");
CREATE INDEX "AdviserArchivedStudent_teacherId_idx" ON "AdviserArchivedStudent"("teacherId");

ALTER TABLE "AdviserArchivedStudent" ADD CONSTRAINT "AdviserArchivedStudent_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

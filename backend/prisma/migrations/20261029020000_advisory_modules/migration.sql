-- Advisory modules: the adviser releases a module (name + link + release/due
-- dates) once for the whole advisory section, and records each learner's
-- submission. Submissions follow the dual-identity rule: exactly one of
-- studentId (StudentProfile account) / rosterId (enlisted learner) is set.

CREATE TABLE "AdvisoryModule" (
  "id"          TEXT NOT NULL,
  "sectionId"   TEXT NOT NULL,
  "moduleName"  TEXT NOT NULL,
  "moduleUrl"   TEXT,
  "description" TEXT,
  "releaseDate" TIMESTAMP(3),
  "dueDate"     TIMESTAMP(3),
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvisoryModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvisoryModuleSubmission" (
  "id"            TEXT NOT NULL,
  "moduleId"      TEXT NOT NULL,
  "studentId"     TEXT,
  "rosterId"      TEXT,
  "submissionUrl" TEXT,
  "submitted"     BOOLEAN NOT NULL DEFAULT false,
  "submittedAt"   TIMESTAMP(3),
  "remarks"       TEXT,
  "recordedBy"    TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvisoryModuleSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvisoryModule_sectionId_idx" ON "AdvisoryModule"("sectionId");
CREATE INDEX "AdvisoryModuleSubmission_moduleId_idx" ON "AdvisoryModuleSubmission"("moduleId");
CREATE INDEX "AdvisoryModuleSubmission_studentId_idx" ON "AdvisoryModuleSubmission"("studentId");
CREATE INDEX "AdvisoryModuleSubmission_rosterId_idx" ON "AdvisoryModuleSubmission"("rosterId");
CREATE UNIQUE INDEX "AdvisoryModuleSubmission_moduleId_studentId_key"
  ON "AdvisoryModuleSubmission"("moduleId", "studentId");
CREATE UNIQUE INDEX "AdvisoryModuleSubmission_moduleId_rosterId_key"
  ON "AdvisoryModuleSubmission"("moduleId", "rosterId");

ALTER TABLE "AdvisoryModule" ADD CONSTRAINT "AdvisoryModule_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvisoryModule" ADD CONSTRAINT "AdvisoryModule_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdvisoryModuleSubmission" ADD CONSTRAINT "AdvisoryModuleSubmission_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "AdvisoryModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvisoryModuleSubmission" ADD CONSTRAINT "AdvisoryModuleSubmission_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvisoryModuleSubmission" ADD CONSTRAINT "AdvisoryModuleSubmission_rosterId_fkey"
  FOREIGN KEY ("rosterId") REFERENCES "StudentRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvisoryModuleSubmission" ADD CONSTRAINT "AdvisoryModuleSubmission_recordedBy_fkey"
  FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdvisoryModuleSubmission" ADD CONSTRAINT "AdvisoryModuleSubmission_student_or_roster_check"
  CHECK ((("studentId" IS NOT NULL)::int + ("rosterId" IS NOT NULL)::int) = 1);

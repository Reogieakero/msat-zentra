-- Teacher-raised grade flags (raise/resolve/escalate workflow)
CREATE TYPE "GradeFlagReason" AS ENUM ('wrong_score', 'missing_assessment', 'transmutation_error', 'late_submission', 'other');
CREATE TYPE "GradeFlagStatus" AS ENUM ('open', 'resolved', 'escalated');

CREATE TABLE "GradeFlag" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "reason" "GradeFlagReason" NOT NULL,
  "note" TEXT,
  "status" "GradeFlagStatus" NOT NULL DEFAULT 'open',
  "raisedBy" TEXT NOT NULL,
  "ownerId" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "escalatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GradeFlag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GradeFlag_status_ownerId_idx" ON "GradeFlag"("status", "ownerId");
CREATE INDEX "GradeFlag_raisedBy_idx" ON "GradeFlag"("raisedBy");
CREATE INDEX "GradeFlag_studentId_idx" ON "GradeFlag"("studentId");
CREATE INDEX "GradeFlag_status_idx" ON "GradeFlag"("status");

ALTER TABLE "GradeFlag"
  ADD CONSTRAINT "GradeFlag_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GradeFlag"
  ADD CONSTRAINT "GradeFlag_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GradeFlag"
  ADD CONSTRAINT "GradeFlag_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GradeFlag"
  ADD CONSTRAINT "GradeFlag_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GradeFlag"
  ADD CONSTRAINT "GradeFlag_raisedBy_fkey"
  FOREIGN KEY ("raisedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GradeFlag"
  ADD CONSTRAINT "GradeFlag_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GradeFlag"
  ADD CONSTRAINT "GradeFlag_resolvedBy_fkey"
  FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend ActionType enum for grade-flag raise/resolve audit entries
ALTER TYPE "ActionType" ADD VALUE 'grade_flag_raise';
ALTER TYPE "ActionType" ADD VALUE 'grade_flag_resolve';

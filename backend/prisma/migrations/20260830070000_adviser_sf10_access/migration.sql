-- Adviser SF10 access requests (registrar review surface)
CREATE TYPE "AccessRequestStatus" AS ENUM ('pending', 'approved', 'denied');

CREATE TABLE "AdviserSf10AccessRequest" (
  "id" TEXT NOT NULL,
  "adviserId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "gradeLevel" "GradeLevel" NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "AccessRequestStatus" NOT NULL DEFAULT 'pending',
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdviserSf10AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdviserSf10AccessRequest_status_idx" ON "AdviserSf10AccessRequest"("status");
CREATE INDEX "AdviserSf10AccessRequest_adviserId_idx" ON "AdviserSf10AccessRequest"("adviserId");
CREATE INDEX "AdviserSf10AccessRequest_sectionId_idx" ON "AdviserSf10AccessRequest"("sectionId");

ALTER TABLE "AdviserSf10AccessRequest"
  ADD CONSTRAINT "AdviserSf10AccessRequest_adviserId_fkey"
  FOREIGN KEY ("adviserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdviserSf10AccessRequest"
  ADD CONSTRAINT "AdviserSf10AccessRequest_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend ActionType enum for SF10 access grant/deny audit entries
ALTER TYPE "ActionType" ADD VALUE 'sf10_access_grant';
ALTER TYPE "ActionType" ADD VALUE 'sf10_access_deny';

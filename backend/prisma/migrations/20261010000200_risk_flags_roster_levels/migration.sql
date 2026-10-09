ALTER TABLE "RiskSnapshot" ADD COLUMN "academicFlag" BOOLEAN;
ALTER TABLE "RiskSnapshot" ADD COLUMN "attendanceFlag" BOOLEAN;
ALTER TABLE "RiskSnapshot" ADD COLUMN "behavioralFlag" BOOLEAN;
ALTER TABLE "RiskSnapshot" ADD COLUMN "academicFlagRaw" BOOLEAN;
ALTER TABLE "RiskSnapshot" ADD COLUMN "attendanceFlagRaw" BOOLEAN;
ALTER TABLE "RiskSnapshot" ADD COLUMN "behavioralFlagRaw" BOOLEAN;

CREATE INDEX IF NOT EXISTS "RiskSnapshot_termId_academicFlag_idx" ON "RiskSnapshot"("termId", "academicFlag");
CREATE INDEX IF NOT EXISTS "RiskSnapshot_termId_attendanceFlag_idx" ON "RiskSnapshot"("termId", "attendanceFlag");
CREATE INDEX IF NOT EXISTS "RiskSnapshot_termId_behavioralFlag_idx" ON "RiskSnapshot"("termId", "behavioralFlag");

ALTER TABLE "StudentRoster" ADD COLUMN "riskCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StudentRoster" ADD COLUMN "riskLevel" TEXT NOT NULL DEFAULT 'Low';
ALTER TABLE "StudentRoster" ADD COLUMN "academicFlag" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "StudentRoster" ADD COLUMN "attendanceFlag" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "StudentRoster" ADD COLUMN "behavioralFlag" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "StudentProfile" ADD COLUMN "academicFlag" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "StudentProfile" ADD COLUMN "attendanceFlag" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "StudentProfile" ADD COLUMN "behavioralFlag" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "StudentRoster_schoolYearId_riskLevel_idx" ON "StudentRoster"("schoolYearId", "riskLevel");

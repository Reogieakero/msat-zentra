ALTER TABLE "RiskSnapshot" ADD COLUMN "riskLevelRaw" TEXT;
ALTER TABLE "RiskSnapshot" ADD COLUMN "riskLevelFinal" TEXT;

UPDATE "RiskSnapshot" SET "riskLevelRaw" = "riskLevel", "riskLevelFinal" = "riskLevel" WHERE "riskLevelRaw" IS NULL;

CREATE INDEX IF NOT EXISTS "RiskSnapshot_termId_riskLevelRaw_idx" ON "RiskSnapshot"("termId", "riskLevelRaw");
CREATE INDEX IF NOT EXISTS "RiskSnapshot_termId_riskLevelFinal_idx" ON "RiskSnapshot"("termId", "riskLevelFinal");
CREATE INDEX IF NOT EXISTS "RiskSnapshot_termId_snapshotDate_idx" ON "RiskSnapshot"("termId", "snapshotDate");

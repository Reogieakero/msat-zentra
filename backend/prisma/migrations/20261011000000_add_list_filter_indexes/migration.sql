-- ZENTRA role-list performance: filter/sort/join indexes for grade-banded
-- account reads, report-snapshot dashboard cache, refresh-token sweeps, and
-- adviser SF10 access review. Uses IF NOT EXISTS so the migration is safe
-- to re-run.

-- Account approval + role-banded roster reads filter on (role, status)
CREATE INDEX IF NOT EXISTS "User_role_status_idx" ON "User"("role", "status");

-- Dashboard/report cache lookups by (reportType, scope, termId)
CREATE INDEX IF NOT EXISTS "ReportSnapshot_reportType_scope_termId_idx" ON "ReportSnapshot"("reportType", "scope", "termId");
CREATE INDEX IF NOT EXISTS "ReportSnapshot_termId_idx" ON "ReportSnapshot"("termId");

-- Refresh-token revocation sweeps + per-user session reads
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- Adviser SF10 access review by (sectionId, status)
CREATE INDEX IF NOT EXISTS "AdviserSf10AccessRequest_sectionId_status_idx" ON "AdviserSf10AccessRequest"("sectionId", "status");

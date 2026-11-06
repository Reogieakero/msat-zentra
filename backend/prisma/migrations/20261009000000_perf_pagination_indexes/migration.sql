-- ZENTRA large-dataset performance: composite + scoping indexes for
-- paginated queue reads. All grounded in observed WHERE/ORDER BY patterns.
-- Uses IF NOT EXISTS so the migration is safe to re-run.

-- Referral queue: WHERE termId + referredToRole + status (nurse/guidance/ADM desks)
CREATE INDEX IF NOT EXISTS "Referral_termId_referredToRole_status_idx" ON "Referral"("termId", "referredToRole", "status");
CREATE INDEX IF NOT EXISTS "Referral_termId_status_idx" ON "Referral"("termId", "status");

-- Intervention stats + queues scoped to the active term
CREATE INDEX IF NOT EXISTS "Intervention_termId_approvalStatus_outcomeStatus_idx" ON "Intervention"("termId", "approvalStatus", "outcomeStatus");

-- Anecdotal lists: term + section ordered by recency; observer mine-queries
CREATE INDEX IF NOT EXISTS "AnecdotalRecord_termId_sectionId_observationDatetime_idx" ON "AnecdotalRecord"("termId", "sectionId", "observationDatetime");
CREATE INDEX IF NOT EXISTS "AnecdotalRecord_observerId_termId_idx" ON "AnecdotalRecord"("observerId", "termId");

-- Notification badge + paged list per user
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- Counseling session scheduling lists
CREATE INDEX IF NOT EXISTS "CounselingSession_status_scheduledAt_idx" ON "CounselingSession"("status", "scheduledAt");

-- Grade flag queues scoped to the active term
CREATE INDEX IF NOT EXISTS "GradeFlag_termId_status_ownerId_idx" ON "GradeFlag"("termId", "status", "ownerId");

-- AuditLog actor + date-range filtering
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

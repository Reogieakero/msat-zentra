-- Coordinator books parent meetings in school or at home (home visitation).
-- IF NOT EXISTS keeps this safe to re-apply (e.g. applied once via
-- runtime SQL during a pooler outage, then recorded by a later deploy).
ALTER TABLE "AdmParentMeeting" ADD COLUMN IF NOT EXISTS "venue" TEXT NOT NULL DEFAULT 'school';

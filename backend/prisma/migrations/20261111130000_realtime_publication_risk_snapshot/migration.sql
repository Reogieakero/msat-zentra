-- Realtime handoff for the adviser intervention monitoring desk.
--
-- The teacher desk at /teacher/advisory/interventions builds its cards from
-- three sources: the section roster/profile, the learner's term "RiskSnapshot"
-- (level + flags) and the "Intervention" plan. "Intervention" and
-- "CounselingSession" are already published (20261111090000), but the desk's
-- "no plan yet" cards only appear when the risk engine writes a snapshot, and
-- that table was never added to the publication — so those changes could only
-- reach the browser through the 20s poll.
--
-- RLS for "RiskSnapshot" lives in 0001_rls.sql and is applied manually via
-- `npx tsx prisma/apply-rls.ts` (same deliberate pattern as "Notification"):
-- publishing a table without a policy would broadcast every learner's risk
-- snapshot to any authenticated subscriber.
--
-- Idempotent and safe on databases without the Supabase publication (local
-- `prisma migrate dev`): guarded by existence check + duplicate_object trap.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "RiskSnapshot";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

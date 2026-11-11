-- Realtime handoff for the guidance desks and the principal assignment board.
--
-- The 20260923030000 migration published "Notification" + the ADM tables. The
-- guidance channel also subscribes to "Intervention" / "CounselingSession", and
-- the principal assignment channel subscribes to "Section"; without publication
-- membership those table events never reach the browser and the desks fall back
-- to the notification poll.
--
-- RLS for these three tables lives in 0001_rls.sql and is applied manually via
-- `npx tsx prisma/apply-rls.ts` (deliberate, same as "Notification"): the
-- browser subscribes with the anon key unless NEXT_PUBLIC_SUPABASE_REALTIME_AUTH
-- is on, so publishing without policies would broadcast every row to any
-- subscriber.
--
-- Idempotent and safe on databases without the Supabase publication (local
-- `prisma migrate dev`): guarded by existence check + duplicate_object trap.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Section";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Intervention";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "CounselingSession";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

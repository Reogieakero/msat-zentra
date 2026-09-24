-- Realtime handoff for ADM parent meetings: coordinator books/records a
-- meeting -> Notification INSERT for referral.referredBy (the adviser) ->
-- adviser sileo toast via the teacher-desk Supabase channel, plus coordinator
-- desk invalidation via table events.
--
-- The adviser's toast depends on these tables being members of the Supabase
-- realtime publication; without that the INSERT still lands in the inbox but
-- no live toast fires (stale cache + refetch remain the fallback).
--
-- Idempotent and safe on databases without the Supabase publication (local
-- `prisma migrate dev`): guarded by existence check + duplicate_object trap.
--
-- NOTE: RLS is intentionally NOT enabled on "Notification" here. The app's
-- Supabase client uses the anon key with no Supabase Auth session (the app
-- signs its own JWTs), so an RLS policy keyed on auth.jwt() would suppress
-- delivery for everyone. Scoping relies on the per-user realtime filter
-- (userId=eq.<me>) plus the backend only ever inserting rows addressed to
-- the intended recipient.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Notification";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Referral";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "AdmParentMeeting";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "AdmLearnerProfile";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "AdmForm";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "AdmDevice";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "AdmModule";
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

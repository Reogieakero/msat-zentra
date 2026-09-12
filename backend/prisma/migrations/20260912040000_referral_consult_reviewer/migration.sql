-- Persist the teacher-picked ADM consultation reviewer ("Who should receive
-- this case?" — nurse | guidance_counselor | lrpc). Only the selected
-- reviewer may act on the case at the consultation stage.

ALTER TABLE "Referral" ADD COLUMN "consultReviewer" TEXT;

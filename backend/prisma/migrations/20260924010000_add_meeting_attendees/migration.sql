-- Attendees present at an ADM parent meeting, recorded by the ADM
-- Coordinator when logging attendance: a JSON array of
-- { name, role } objects. Roles come from a fixed set enforced at the
-- API layer (parent/guardian, teacher, student, …).
ALTER TABLE "AdmParentMeeting" ADD COLUMN "attendees" JSONB NOT NULL DEFAULT '[]';

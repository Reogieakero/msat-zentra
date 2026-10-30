-- Submissions can come in three ways: a link, an uploaded PDF/Word file, or
-- physical passing of the answered module to the adviser. Existing rows keep
-- the default (link).
CREATE TYPE "AdvisorySubmissionKind" AS ENUM ('link', 'file', 'physical');

ALTER TABLE "AdvisoryModuleSubmission"
  ADD COLUMN "submissionKind" "AdvisorySubmissionKind" NOT NULL DEFAULT 'link',
  ADD COLUMN "fileUrl" TEXT,
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "fileMimeType" TEXT,
  ADD COLUMN "fileSize" INTEGER;

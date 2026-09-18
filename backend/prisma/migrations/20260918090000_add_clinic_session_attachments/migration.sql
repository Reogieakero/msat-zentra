-- Clinic session documentation: image attachments filed on a session.
-- Filing the closing documentation is what finishes a clinic case
-- (auto-resolve), so these rows are the case evidence trail.

ALTER TYPE "ActionType" ADD VALUE 'session_document_added';

CREATE TABLE "ClinicSessionAttachment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicSessionAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicSessionAttachment_sessionId_idx" ON "ClinicSessionAttachment"("sessionId");

ALTER TABLE "ClinicSessionAttachment" ADD CONSTRAINT "ClinicSessionAttachment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CounselingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClinicSessionAttachment" ADD CONSTRAINT "ClinicSessionAttachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

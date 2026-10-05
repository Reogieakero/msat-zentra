-- Meeting documentation filed on ADM parent meetings (mirrors clinic session attachments)
CREATE TABLE "AdmMeetingAttachment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmMeetingAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdmMeetingAttachment_meetingId_idx" ON "AdmMeetingAttachment"("meetingId");

ALTER TABLE "AdmMeetingAttachment" ADD CONSTRAINT "AdmMeetingAttachment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "AdmParentMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdmMeetingAttachment" ADD CONSTRAINT "AdmMeetingAttachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Staff invited to an ADM parent meeting (picked by the ADM Coordinator at booking)
CREATE TABLE "AdmMeetingInvitee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmMeetingInvitee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdmMeetingInvitee_meetingId_userId_key" ON "AdmMeetingInvitee"("meetingId", "userId");
CREATE INDEX "AdmMeetingInvitee_userId_idx" ON "AdmMeetingInvitee"("userId");

ALTER TABLE "AdmMeetingInvitee" ADD CONSTRAINT "AdmMeetingInvitee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "AdmParentMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdmMeetingInvitee" ADD CONSTRAINT "AdmMeetingInvitee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

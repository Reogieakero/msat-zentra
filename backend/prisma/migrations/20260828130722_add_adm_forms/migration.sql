-- CreateEnum
CREATE TYPE "AdmFormType" AS ENUM ('REFERRAL_FORM', 'ANECDOTAL_REPORT', 'CERTIFICATION', 'MINUTES_OF_MEETING', 'HV_FORM');

-- CreateEnum
CREATE TYPE "AdmFormStatus" AS ENUM ('pending', 'submitted', 'verified');

-- CreateTable
CREATE TABLE "AdmForm" (
    "id" TEXT NOT NULL,
    "admLearnerProfileId" TEXT NOT NULL,
    "formType" "AdmFormType" NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT,
    "status" "AdmFormStatus" NOT NULL DEFAULT 'submitted',
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "AdmForm_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AdmForm" ADD CONSTRAINT "AdmForm_admLearnerProfileId_fkey" FOREIGN KEY ("admLearnerProfileId") REFERENCES "AdmLearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmForm" ADD CONSTRAINT "AdmForm_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
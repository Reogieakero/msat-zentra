-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'parent', 'subject_teacher', 'adviser', 'nurse', 'adm_coordinator', 'guidance_counselor', 'record_keeper', 'registrar', 'principal');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "GradeLevel" AS ENUM ('G7', 'G8', 'G9', 'G10', 'G11', 'G12');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('Low', 'Moderate', 'High');

-- CreateEnum
CREATE TYPE "Confidentiality" AS ENUM ('restricted', 'confidential');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'late', 'excused');

-- CreateEnum
CREATE TYPE "Session" AS ENUM ('AM', 'PM');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('WRITTEN_WORK', 'PERFORMANCE_TASK', 'QUARTERLY_EXAM');

-- CreateEnum
CREATE TYPE "LockStatus" AS ENUM ('unlocked', 'locked');

-- CreateEnum
CREATE TYPE "Remarks" AS ENUM ('Passed', 'Failed');

-- CreateEnum
CREATE TYPE "ReferralTarget" AS ENUM ('nurse', 'guidance_counselor', 'adm_coordinator', 'principal');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('pending', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'modified');

-- CreateEnum
CREATE TYPE "OutcomeStatus" AS ENUM ('ongoing', 'resolved', 'unresolved');

-- CreateEnum
CREATE TYPE "AdmEligibility" AS ENUM ('pending', 'eligible', 'ineligible');

-- CreateEnum
CREATE TYPE "Sf10Source" AS ENUM ('auto_populated', 'ocr_upload', 'manual');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('sf10_update', 'grade_lock', 'grade_unlock', 'anecdotal_edit', 'health_record_edit', 'home_visitation_edit', 'adm_edit', 'referral_status_change', 'intervention_approval', 'account_approval', 'role_change');

-- CreateEnum
CREATE TYPE "NotifChannel" AS ENUM ('web', 'mobile', 'email');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "fullName" TEXT NOT NULL,
    "contactNumber" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL,
    "lrn" TEXT NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,
    "sectionId" TEXT,
    "birthdate" TIMESTAMP(3),
    "address" TEXT,
    "photoUrl" TEXT,
    "riskCount" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'Low',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ParentProfile" (
    "userId" TEXT NOT NULL,
    "address" TEXT,
    "occupation" TEXT,

    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ParentStudentLink" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentStudentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "department" TEXT,
    "isAdviser" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SchoolYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "termNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "adviserId" TEXT,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSubjectAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,

    CONSTRAINT "TeacherSubjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeComponent" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "componentType" "ComponentType" NOT NULL,
    "weightPercentage" INTEGER NOT NULL,

    CONSTRAINT "GradeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "gradeComponentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "dateGiven" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGrade" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rawScore" DOUBLE PRECISION NOT NULL,
    "percentageScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StudentGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalGrade" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "computedAverage" DOUBLE PRECISION,
    "transmutedGrade" DOUBLE PRECISION,
    "remarks" "Remarks",
    "lockStatus" "LockStatus" NOT NULL DEFAULT 'unlocked',
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "finalizedBy" TEXT,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "FinalGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "session" "Session" NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "termId" TEXT NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnecdotalRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "observationDatetime" TIMESTAMP(3) NOT NULL,
    "descriptionOfIncident" TEXT NOT NULL,
    "descriptionOfLocation" TEXT,
    "notesRecommendationsActions" TEXT,
    "classPerformance" TEXT,
    "attendanceSummary" TEXT,
    "attachmentUrl" TEXT,
    "termId" TEXT NOT NULL,
    "confidentialityLevel" "Confidentiality" NOT NULL DEFAULT 'restricted',

    CONSTRAINT "AnecdotalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnecdotalRecordFollowup" (
    "id" TEXT NOT NULL,
    "anecdotalRecordId" TEXT NOT NULL,
    "followupBy" TEXT NOT NULL,
    "followupDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "AnecdotalRecordFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "anecdotalRecordId" TEXT NOT NULL,
    "referredToRole" "ReferralTarget" NOT NULL,
    "referredBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'pending',
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "referralId" TEXT,
    "riskLevelAtFlag" "RiskLevel" NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "approvedAction" TEXT,
    "outcomeStatus" "OutcomeStatus" NOT NULL DEFAULT 'ongoing',
    "outcomeNotes" TEXT,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "referralId" TEXT,
    "visitDatetime" TIMESTAMP(3) NOT NULL,
    "complaint" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "treatmentGiven" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "confidentialityLevel" "Confidentiality" NOT NULL DEFAULT 'restricted',

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeVisitationRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "referralId" TEXT,
    "personVisited" TEXT NOT NULL,
    "homeCondition" TEXT NOT NULL,
    "familyCondition" TEXT NOT NULL,
    "agreements" TEXT NOT NULL,
    "parentSignature" TEXT,
    "studentSignature" TEXT,
    "certificationBy" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "confidentialityLevel" "Confidentiality" NOT NULL DEFAULT 'restricted',

    CONSTRAINT "HomeVisitationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmLearnerProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "eligibilityStatus" "AdmEligibility" NOT NULL DEFAULT 'pending',
    "preparedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "certificationDetails" JSONB,
    "termId" TEXT NOT NULL,
    "confidentialityLevel" "Confidentiality" NOT NULL DEFAULT 'restricted',

    CONSTRAINT "AdmLearnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmParentMeeting" (
    "id" TEXT NOT NULL,
    "admLearnerProfileId" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "meetingDatetime" TIMESTAMP(3) NOT NULL,
    "attended" BOOLEAN NOT NULL,
    "parentConfirmedAt" TIMESTAMP(3),
    "minutesOfMeeting" TEXT,
    "attendanceLogbookRef" TEXT,

    CONSTRAINT "AdmParentMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmModule" (
    "id" TEXT NOT NULL,
    "admLearnerProfileId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "submissionDate" TIMESTAMP(3),
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "AdmModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmDevice" (
    "id" TEXT NOT NULL,
    "admLearnerProfileId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "deviceSerial" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "returnedDate" TIMESTAMP(3),
    "conditionNotes" TEXT,

    CONSTRAINT "AdmDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sf10Record" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "source" "Sf10Source" NOT NULL,
    "uploadedFileUrl" TEXT,
    "ocrExtractedData" JSONB,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "currentVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Sf10Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sf10RecordVersion" (
    "id" TEXT NOT NULL,
    "sf10RecordId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sf10RecordVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reason" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSnapshot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "riskCount" INTEGER NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termId" TEXT NOT NULL,

    CONSTRAINT "RiskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "termId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceTable" TEXT,
    "sourceId" TEXT,
    "channel" "NotifChannel"[],
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_lrn_key" ON "StudentProfile"("lrn");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudentLink_parentId_studentId_key" ON "ParentStudentLink"("parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_employeeId_key" ON "StaffProfile"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Term_schoolYearId_termNumber_key" ON "Term"("schoolYearId", "termNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSubjectAssignment_teacherId_subjectId_sectionId_term_key" ON "TeacherSubjectAssignment"("teacherId", "subjectId", "sectionId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeComponent_subjectId_termId_componentType_key" ON "GradeComponent"("subjectId", "termId", "componentType");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGrade_assessmentId_studentId_key" ON "StudentGrade"("assessmentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalGrade_studentId_subjectId_termId_key" ON "FinalGrade"("studentId", "subjectId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_session_key" ON "AttendanceRecord"("studentId", "date", "session");

-- CreateIndex
CREATE UNIQUE INDEX "Sf10Record_studentId_key" ON "Sf10Record"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_adviserId_fkey" FOREIGN KEY ("adviserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectAssignment" ADD CONSTRAINT "TeacherSubjectAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectAssignment" ADD CONSTRAINT "TeacherSubjectAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectAssignment" ADD CONSTRAINT "TeacherSubjectAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectAssignment" ADD CONSTRAINT "TeacherSubjectAssignment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_gradeComponentId_fkey" FOREIGN KEY ("gradeComponentId") REFERENCES "GradeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalGrade" ADD CONSTRAINT "FinalGrade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalGrade" ADD CONSTRAINT "FinalGrade_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalGrade" ADD CONSTRAINT "FinalGrade_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnecdotalRecord" ADD CONSTRAINT "AnecdotalRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnecdotalRecord" ADD CONSTRAINT "AnecdotalRecord_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnecdotalRecord" ADD CONSTRAINT "AnecdotalRecord_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnecdotalRecord" ADD CONSTRAINT "AnecdotalRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnecdotalRecordFollowup" ADD CONSTRAINT "AnecdotalRecordFollowup_anecdotalRecordId_fkey" FOREIGN KEY ("anecdotalRecordId") REFERENCES "AnecdotalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnecdotalRecordFollowup" ADD CONSTRAINT "AnecdotalRecordFollowup_followupBy_fkey" FOREIGN KEY ("followupBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_anecdotalRecordId_fkey" FOREIGN KEY ("anecdotalRecordId") REFERENCES "AnecdotalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeVisitationRecord" ADD CONSTRAINT "HomeVisitationRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeVisitationRecord" ADD CONSTRAINT "HomeVisitationRecord_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeVisitationRecord" ADD CONSTRAINT "HomeVisitationRecord_certificationBy_fkey" FOREIGN KEY ("certificationBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeVisitationRecord" ADD CONSTRAINT "HomeVisitationRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmLearnerProfile" ADD CONSTRAINT "AdmLearnerProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmLearnerProfile" ADD CONSTRAINT "AdmLearnerProfile_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmLearnerProfile" ADD CONSTRAINT "AdmLearnerProfile_preparedBy_fkey" FOREIGN KEY ("preparedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmLearnerProfile" ADD CONSTRAINT "AdmLearnerProfile_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmLearnerProfile" ADD CONSTRAINT "AdmLearnerProfile_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmParentMeeting" ADD CONSTRAINT "AdmParentMeeting_admLearnerProfileId_fkey" FOREIGN KEY ("admLearnerProfileId") REFERENCES "AdmLearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmParentMeeting" ADD CONSTRAINT "AdmParentMeeting_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmModule" ADD CONSTRAINT "AdmModule_admLearnerProfileId_fkey" FOREIGN KEY ("admLearnerProfileId") REFERENCES "AdmLearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmModule" ADD CONSTRAINT "AdmModule_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmDevice" ADD CONSTRAINT "AdmDevice_admLearnerProfileId_fkey" FOREIGN KEY ("admLearnerProfileId") REFERENCES "AdmLearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmDevice" ADD CONSTRAINT "AdmDevice_issuedBy_fkey" FOREIGN KEY ("issuedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sf10Record" ADD CONSTRAINT "Sf10Record_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sf10Record" ADD CONSTRAINT "Sf10Record_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sf10Record" ADD CONSTRAINT "Sf10Record_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sf10RecordVersion" ADD CONSTRAINT "Sf10RecordVersion_sf10RecordId_fkey" FOREIGN KEY ("sf10RecordId") REFERENCES "Sf10Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sf10RecordVersion" ADD CONSTRAINT "Sf10RecordVersion_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

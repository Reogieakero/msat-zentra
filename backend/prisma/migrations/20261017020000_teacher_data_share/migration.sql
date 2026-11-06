-- Add per-teacher student-data sharing consent (default OFF = private).
-- OFF: only the login teacher sees grades/attendance they encode.
-- ON: adviser, guidance, and allowed roles see in real-time.
-- Principal/registrar/record_keeper bypass at application layer.
ALTER TABLE "StaffProfile" ADD COLUMN "shareStudentData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "shareUpdatedAt" TIMESTAMP(3);

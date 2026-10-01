-- Per-term workspace verification for teachers (auth gate per term)
CREATE TABLE "TeacherTermGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "teacherNameId" TEXT,
    "attendanceVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherTermGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherTermGrant_userId_termId_key" ON "TeacherTermGrant"("userId", "termId");
CREATE INDEX "TeacherTermGrant_termId_idx" ON "TeacherTermGrant"("termId");

ALTER TABLE "TeacherTermGrant" ADD CONSTRAINT "TeacherTermGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherTermGrant" ADD CONSTRAINT "TeacherTermGrant_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherTermGrant" ADD CONSTRAINT "TeacherTermGrant_teacherNameId_fkey" FOREIGN KEY ("teacherNameId") REFERENCES "TeacherName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

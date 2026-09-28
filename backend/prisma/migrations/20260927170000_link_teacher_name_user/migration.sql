-- Teachers link their login to their catalog row by entering its code on
-- teacher/classes, attaching the row's subjects and timeslots to their
-- personal calendar. Nullable + unique: unclaimed rows stay valid, and one
-- login holds at most one row.
ALTER TABLE "TeacherName" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "TeacherName_userId_key" ON "TeacherName"("userId");

ALTER TABLE "TeacherName" ADD CONSTRAINT "TeacherName_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Advisory claim codes: principal assigns a teacher name + code per section,
-- the teacher claims the seat by entering the code. adviserId stays NULL until
-- claimed; the code is consumed (cleared) on successful claim and rotated on
-- every new assignment.
ALTER TABLE "Section" ADD COLUMN "adviserCode" TEXT;
CREATE UNIQUE INDEX "Section_adviserCode_key" ON "Section"("adviserCode");

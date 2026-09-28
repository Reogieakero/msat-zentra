-- Principal-managed free-text advisory listing on sections.
-- adviserLabel is written whenever a name is assigned; adviserId is only
-- linked when the name resolves to exactly one active teacher, so the
-- assignment listing never blocks on teacher accounts.
ALTER TABLE "Section" ADD COLUMN "adviserLabel" TEXT;

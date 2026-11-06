-- Principal signage: signing an ADM case files a dedicated Principal signage
-- folder so the signed paperwork lives beside the rest of the case documents.
-- Idempotent so the migration is safe to re-run.

ALTER TYPE "AdmFormType" ADD VALUE IF NOT EXISTS 'PRINCIPAL_SIGNAGE';

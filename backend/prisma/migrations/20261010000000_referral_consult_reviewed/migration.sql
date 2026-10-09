ALTER TABLE "Referral" ADD COLUMN "consultReviewedAt" TIMESTAMP(3);

UPDATE "Referral" SET "consultReviewedAt" = sub."earliest"
FROM (
  SELECT "sourceId", MIN("createdAt") AS "earliest"
  FROM "AuditLog"
  WHERE "sourceTable" = 'referrals'
    AND "actionType" IN ('referral_status_change', 'referral_reassigned', 'referral_dismissed')
    AND "reason" LIKE 'ADM consultation %'
  GROUP BY "sourceId"
) AS sub
WHERE "Referral"."id" = sub."sourceId"
  AND "Referral"."consultReviewedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Referral_termId_referredToRole_consultReviewedAt_idx" ON "Referral"("termId", "referredToRole", "consultReviewedAt");

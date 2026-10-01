-- Add profile photo + workspace palette columns to staff profiles
ALTER TABLE "StaffProfile" ADD COLUMN "photoUrl" TEXT,
ADD COLUMN "primaryColor" TEXT,
ADD COLUMN "secondaryColor" TEXT;

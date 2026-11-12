-- Add the system administrator role. Admin accounts sign in through the
-- dedicated /login/admin portal and are never part of the staff portal.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'admin';

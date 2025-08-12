-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."AuditAction" ADD VALUE 'MEETING_SCHEDULE';
ALTER TYPE "public"."AuditAction" ADD VALUE 'MEETING_UPDATE';
ALTER TYPE "public"."AuditAction" ADD VALUE 'MEETING_CANCEL';
ALTER TYPE "public"."AuditAction" ADD VALUE 'MEETING_ATTENDANCE_MARK';
ALTER TYPE "public"."AuditAction" ADD VALUE 'MEETING_MINUTES_SAVE';
